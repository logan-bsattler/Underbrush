import { describe, expect, it } from 'vitest';
import { commissionCost, commissionFillable, content, dispatch, emptyJournal, newGame, nextCommission, orderById, perksFor, recordYear, score, seasonOf, standardPerks, tiersFor, type GameState } from '../src/core';

const withCommissions = (coins = 100): GameState => {
  const s = newGame({ seed: 'commission', perks: { ...standardPerks(), commissions: true } });
  return { ...s, coins };
};

describe('commissions', () => {
  it('is stocked from Elder of the Wood, not before, and never in the standard kit', () => {
    const at = (level: number) => perksFor({ ...emptyJournal(), renown: content.progression.levels[level - 1].renown }, []).commissions;
    expect(at(6)).toBe(false);
    expect(at(7)).toBe(true);
    expect(standardPerks().commissions).toBe(false);
  });

  it('costs coins up front, one at a time, doubling with each one taken', () => {
    let s = withCommissions();
    expect(commissionCost(s)).toBe(content.rules.commissionCost);
    s = dispatch(s, { type: 'takeCommission' }).state;
    expect(s.coins).toBe(100 - content.rules.commissionCost);
    expect(s.commission.open).not.toBeNull();
    expect(() => dispatch(s, { type: 'takeCommission' })).toThrow(/Deliver the commission/);
    expect(commissionCost(s)).toBe(content.rules.commissionCost * content.rules.commissionGrowth);
  });

  it('delivers like an order, for its points, and leaves the order board as it was', () => {
    let s = dispatch(withCommissions(), { type: 'takeCommission' }).state;
    const o = orderById(s.commission.open!)!;
    const need = o.need.kind === 'species' ? o.need.items : null;
    if (!need) return;
    s = { ...s, storage: { ...need } };
    const board = s.orders.visible.slice();
    const r = dispatch(s, { type: 'fillOrder', order: o.id }).state;
    expect(r.commission.open).toBeNull();
    expect(r.orders.visible).toEqual(board);
    expect(score(r).orders).toBe(o.points);
  });

  it('deals only what can still be filled: no spring fair once spring is gone, unless the Morel is in storage', () => {
    const fair = orderById('c-fair')!;
    const summer = Array.from({ length: content.rules.rounds }, (_, i) => i + 1).find((r) => seasonOf(r) === 'summer')!;
    const s = withCommissions();
    const late: GameState = { ...s, round: summer, commission: { ...s.commission, deck: ['c-fair', 'c-mill'] } };
    expect(commissionFillable({ ...late, round: 1 }, fair)).toBe(true);
    expect(commissionFillable(late, fair)).toBe(false);
    expect(nextCommission(late)).toBe('c-mill');
    const r = dispatch(late, { type: 'takeCommission' }).state;
    expect(r.commission.open).toBe('c-mill');
    expect(r.commission.deck).toEqual(['c-fair']);
    expect(nextCommission({ ...late, storage: { morel: 4 } })).toBe('c-fair');
    expect(() => dispatch({ ...late, commission: { ...late.commission, deck: ['c-fair'] } }, { type: 'takeCommission' })).toThrow(/can still be found/);
  });

  it("can't be taken without the level", () => {
    const s = { ...newGame({ seed: 'no-commission' }), coins: 100 };
    expect(() => dispatch(s, { type: 'takeCommission' })).toThrow(/doesn't bring you commissions/);
  });
});

describe('festival tiers by level', () => {
  it('rise with the homestead level as well as the generation', () => {
    const top = content.progression.levels[content.progression.levels.length - 1];
    const lv = (renown: number, generation = 1) => tiersFor(newGame({ seed: 't', perks: perksFor({ ...emptyJournal(), renown, generation }, []) }))[0].min;
    const base = content.rules.tiers[0].min;
    expect(lv(0)).toBe(base + content.progression.levels[0].tierLift);
    expect(lv(top.renown)).toBe(base + top.tierLift);
    expect(lv(top.renown, 2)).toBe(base + top.tierLift + content.progression.legacy.tierStep);
    expect(tiersFor(newGame({ seed: 'daily', mode: 'daily' }))[0].min).toBe(base);
  });
});

describe('species mastery', () => {
  it('an Expert knows the lookalike too, without ever being fooled by it', () => {
    const expert = content.progression.mastery.find((m) => m.level === 2)!.ids;
    const end = { ...newGame({ seed: 'expert' }), over: true };
    end.stats = { ...end.stats, identified: { chanterelle: expert } };
    const j = recordYear(emptyJournal(), end);
    expect(j.lookalikes).toContain('chanterelle');
    expect(j.lookalikes).not.toContain('oyster');
  });
});
