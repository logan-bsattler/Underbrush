import {
  content,
  dispatch,
  emptyGround,
  orderPayment,
  plantableSquares,
  zoneStatus,
  type Action,
  type GameState,
} from '../src/core';

/**
 * A simple greedy player used to fuzz the rules and to estimate pacing.
 * It is deliberately unclever: the point is a repeatable baseline, not a strong strategy.
 */
export function playYear(start: GameState, opts: { greed?: number } = {}): GameState {
  const greed = opts.greed ?? 3;
  let s = start;
  const act = (a: Action) => {
    s = dispatch(s, a).state;
  };
  const value = (id: string | null) => (id ? content.species[id].value : 0);

  let guard = 0;
  while (!s.over) {
    if (++guard > 2000) throw new Error('bot stuck');
    if (s.night) act({ type: 'dismissNight' });
    while (s.pendingCrosses.length) {
      const x = s.pendingCrosses[0];
      act({ type: 'resolveCross', index: 0, replace: value(s.grid[x.a].species) <= value(s.grid[x.b].species) ? 'a' : 'b' });
    }
    while (s.shed.length && emptyGround(s).length) act({ type: 'placeSubstrate', index: 0, square: emptyGround(s)[0] });
    if (s.gear.includes('growtent') && !s.tentPlaced) {
      const bed = s.grid.findIndex((sq) => sq.species && !sq.tree);
      act({ type: 'placeTent', square: bed >= 0 ? bed : s.grid.findIndex((sq) => !sq.tree) });
    }

    while (s.actionsLeft > 0) {
      const blighted = s.grid.findIndex((sq) => sq.blight);
      if (blighted >= 0) {
        act({ type: 'clearBlight', square: blighted });
        continue;
      }
      if (s.grid.some((sq) => sq.stage === 'F' && !sq.blight)) {
        act({ type: 'harvest' });
        continue;
      }
      const thirsty = s.grid.filter((sq, i) => sq.species && i % 4 !== 0).length;
      if (!s.watered && s.weather !== 'rain' && (s.weather === 'dryspell' ? s.grid.some((q) => q.species) : thirsty >= 2)) {
        act({ type: 'water' });
        continue;
      }
      const unknown = s.basket.find((b) => !b.identified);
      if (unknown) {
        act({ type: 'identify', uid: unknown.uid });
        continue;
      }
      const plantable = s.basket.find((b) => b.identified && plantableSquares(s, b.species).length);
      if (plantable) {
        act({ type: 'plant', uid: plantable.uid, square: plantableSquares(s, plantable.species)[0] });
        continue;
      }
      const fillable = s.orders.visible.find((o) => orderPayment(s.storage, content.orders.find((x) => x.id === o)!));
      const wanted = ['biggerbasket', 'knife', 'lantern', 'dehydrator', 'fieldguide', 'growtent', 'trailmap'];
      const affordable = wanted.find((g) => !s.gear.includes(g) && s.coins >= content.gear.find((x) => x.id === g)!.cost);
      const lastWeekOfSeason = s.round % 3 === 0;
      if (fillable || affordable || (lastWeekOfSeason && Object.keys(s.storage).length && !s.gear.includes('dehydrator'))) {
        if (fillable) act({ type: 'fillOrder', order: fillable });
        if (lastWeekOfSeason || affordable) {
          for (const id of Object.keys(s.storage)) {
            const neededSomewhere = s.orders.visible.some((o) => {
              const need = content.orders.find((x) => x.id === o)!.need;
              return need.kind === 'species' && id in need.items;
            });
            if (!neededSomewhere || lastWeekOfSeason) act({ type: 'sell', species: id, count: s.storage[id] });
          }
        }
        for (const g of wanted) {
          const def = content.gear.find((x) => x.id === g)!;
          if (!s.gear.includes(g) && s.coins >= def.cost) act({ type: 'buyGear', gear: g });
        }
        if (s.market) {
          act({ type: 'leaveMarket' });
          continue;
        }
      }
      const zones = content.zones.filter((z) => zoneStatus(s, z).open);
      if (!zones.length) break;
      const zone = zones[zones.length - 1].id === 'burnscar' ? 'burnscar' : zones[(s.round + s.actionsLeft) % zones.length].id;
      act({ type: 'forage', zone });
      while (s.forage?.status === 'open') {
        const t = s.forage;
        const full = s.basket.length >= (s.gear.includes('biggerbasket') ? 6 : 4);
        if (full || (t.hazards >= 1 && t.drawn.length >= greed)) act({ type: 'stopForage' });
        else act({ type: 'draw' });
      }
      act({ type: 'closeTrip' });
    }
    act({ type: 'endWeek' });
  }
  return s;
}
