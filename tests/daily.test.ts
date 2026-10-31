import { describe, expect, it } from 'vitest';
import { dailyMonth, dailyStats, dayBefore, newGame, standardPerks, type YearRecord } from '../src/core';
import { shareText } from '../src/ui/share';

const year = (seed: string, score = 20, mode: YearRecord['mode'] = 'daily'): YearRecord => ({
  finished: '2026-10-30T12:00:00.000Z',
  mode,
  seed,
  score,
  tier: null,
  renown: score,
  levelFrom: 1,
  levelTo: 1,
  masteryUps: [],
});
const days = (...ds: string[]) => ds.map((d) => year(`daily-${d}`));

describe('daily stats', () => {
  it('steps back a day across month and year ends', () => {
    expect(dayBefore('2026-11-01')).toBe('2026-10-31');
    expect(dayBefore('2026-03-01')).toBe('2026-02-28');
    expect(dayBefore('2027-01-01')).toBe('2026-12-31');
  });

  it('counts a streak ending today', () => {
    const s = dailyStats(days('2026-10-28', '2026-10-29', '2026-10-30'), '2026-10-30');
    expect(s).toMatchObject({ streak: 3, longest: 3, playedToday: true, first: '2026-10-28' });
  });

  it('keeps the streak through yesterday while today is unplayed', () => {
    const s = dailyStats(days('2026-10-28', '2026-10-29'), '2026-10-30');
    expect(s).toMatchObject({ streak: 2, playedToday: false });
  });

  it('drops to zero after a whole missed day, but keeps the longest', () => {
    const s = dailyStats(days('2026-10-20', '2026-10-21', '2026-10-22', '2026-10-27', '2026-10-28'), '2026-10-30');
    expect(s.streak).toBe(0);
    expect(s.longest).toBe(3);
  });

  it('runs a streak across a month end', () => {
    expect(dailyStats(days('2026-10-30', '2026-10-31', '2026-11-01'), '2026-11-01').streak).toBe(3);
  });

  it('ignores story years and counts a day once', () => {
    const s = dailyStats([...days('2026-10-29', '2026-10-30'), year('daily-2026-10-30', 40), year('story-abc', 50, 'story')], '2026-10-30');
    expect(Object.keys(s.byDay)).toEqual(['2026-10-29', '2026-10-30']);
    expect(s.byDay['2026-10-30'].score).toBe(20);
    expect(s.streak).toBe(2);
  });

  it('has nothing before the first daily', () => {
    expect(dailyStats([year('story-abc', 30, 'story')], '2026-10-30')).toMatchObject({ streak: 0, longest: 0, first: null });
  });

  it("sums up a month's dailies", () => {
    const s = dailyStats([year('daily-2026-09-30', 50), year('daily-2026-10-01', 20), year('daily-2026-10-05', 31)], '2026-10-30');
    expect(dailyMonth(s, '2026-10')).toEqual({ played: 2, average: 26, best: 31 });
    expect(dailyMonth(s, '2026-08')).toEqual({ played: 0, average: 0, best: 0 });
  });
});

describe('daily share card', () => {
  const g = newGame({ mode: 'daily', seed: 'daily-2026-10-30', perks: standardPerks() });
  it('puts a streak of 2 or more on the first line', () => {
    expect(shareText(g, 'u', 4).split('\n')[0]).toBe('Underbrush daily · 2026-10-30 · streak 4');
    expect(shareText(g, 'u', 1).split('\n')[0]).toBe('Underbrush daily · 2026-10-30');
    expect(shareText(g, 'u').split('\n')[0]).toBe('Underbrush daily · 2026-10-30');
  });
});
