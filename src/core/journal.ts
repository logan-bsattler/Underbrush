import { achievementsEarned } from './achievements';
import { content as defaultContent } from './content';
import { score } from './engine';
import { challengeBonus, levelFor, masteryLevel } from './progression';
import { completedSets } from './underground';
import type { Content, GameState } from './types';

export interface YearRecord {
  finished: string;
  mode: GameState['mode'];
  seed: string;
  score: number;
  tier: string | null;
  /** Renown this year earned, and the homestead level before and after it. */
  renown: number;
  levelFrom: number;
  levelTo: number;
  /** Species whose mastery level rose this year. */
  masteryUps: string[];
  // The rest came after the first saves, so years recorded before them don't have them. Ids only: names come from content.
  /** The festival's points, row by row; they sum to `score`. */
  breakdown?: ScoreBreakdown;
  board?: string;
  generation?: number;
  /** Legend challenges taken on. */
  challenges?: string[];
  /** Orders delivered. */
  orders?: string[];
  hybrids?: string[];
  artifacts?: string[];
}

export type ScoreBreakdown = Omit<ReturnType<typeof score>, 'total' | 'tier'>;

/**
 * The field journal carries over between years, like the tabletop journal pad,
 * and holds the homestead's progression: renown, gear ever owned and species mastery.
 */
export interface Journal {
  version: 1;
  discovered: string[];
  lookalikes: string[];
  hybrids: string[];
  years: YearRecord[];
  best: number;
  renown: number;
  /** Real identifications per species across every finished year. */
  idCounts: Record<string, number>;
  /** Gear bought in any year; heirlooms are chosen from these. */
  gearOwned: string[];
  /** Achievement ids earned, in the order they were earned. */
  achievements: string[];
  /** Zones ever cleared: every card but the hazards turned on one trip. */
  zonesCleared: string[];
  /** The generation working the homestead now, from 1. */
  generation: number;
  /** Each generation that passed the homestead on: the renown it reached and its story years. */
  lineage: { generation: number; renown: number; years: number }[];
  /** The cabinet of curiosities: every artifact the family has brought home, in the order found. */
  artifacts: string[];
  /** Underground layers the family has reached, as "zone:depth". */
  layers: string[];
  /** The family found the Founder's Cellar: the saga's one puzzle, solved for good. */
  cacheFound: boolean;
  /** The generation that found the cellar: the founder's journal reads one more page each generation after it. */
  cacheGeneration?: number;
}

export function emptyJournal(): Journal {
  return { version: 1, discovered: [], lookalikes: [], hybrids: [], years: [], best: 0, renown: 0, idCounts: {}, gearOwned: [], achievements: [], zonesCleared: [], generation: 1, lineage: [], artifacts: [], layers: [], cacheFound: false };
}

/** Fills in fields added after a journal was first saved. */
export function normalizeJournal(j: Partial<Journal> | null): Journal {
  const base = emptyJournal();
  if (!j) return base;
  const years = (j.years ?? []).map((y: Partial<YearRecord>) => ({
    renown: 0,
    levelFrom: 1,
    levelTo: 1,
    masteryUps: [],
    ...y,
  })) as YearRecord[];
  const out: Journal = { ...base, ...j, years, version: 1 };
  // Cellars found before the founder's journal was kept: the year that scored the cache says which generation found it.
  if (out.cacheFound && out.cacheGeneration === undefined) {
    out.cacheGeneration = years.find((y) => (y.breakdown?.cache ?? 0) > 0)?.generation ?? out.generation;
  }
  return out;
}

/** Folds this year's finds into the journal. Returns the ids that are new to it, sets the cabinet just completed among them. */
export function mergeDiscoveries(j: Journal, s: GameState): { journal: Journal; fresh: string[] } {
  const fresh: string[] = [];
  const add = (list: string[], ids: string[], tag = '') => {
    const out = list.slice();
    for (const id of ids) {
      if (!out.includes(id)) {
        out.push(id);
        fresh.push(tag + id);
      }
    }
    return out;
  };
  const journal: Journal = {
    ...j,
    discovered: add(j.discovered, s.discovered),
    hybrids: add(j.hybrids, s.hybridsMade, 'hybrid:'),
    lookalikes: add(j.lookalikes, s.lookalikesFound, 'lookalike:'),
    achievements: add(j.achievements, achievementsEarned(s), 'achievement:'),
    zonesCleared: Array.from(new Set([...j.zonesCleared, ...s.zonesCleared])),
    artifacts: add(j.artifacts, s.artifacts ?? [], 'artifact:'),
    layers: add(j.layers, s.layersReached ?? [], 'layer:'),
    cacheFound: j.cacheFound || !!s.cacheFound,
  };
  if (journal.cacheFound && !j.cacheFound) {
    journal.cacheGeneration = s.perks.generation;
    fresh.push('cache:cellar');
  }
  const before = completedSets(j.artifacts);
  for (const id of completedSets(journal.artifacts)) if (!before.includes(id)) fresh.push(`set:${id}`);
  return { journal, fresh };
}

/** Records a finished year once (keyed by seed): renown, mastery and gear carry forward. */
export function recordYear(j: Journal, s: GameState, c: Content = defaultContent): Journal {
  const { journal } = mergeDiscoveries(j, s);
  if (journal.years.some((y) => y.seed === s.seed)) return journal;
  const { total, tier, ...breakdown } = score(s, c);
  const sc = { total, tier };
  const levelFrom = levelFor(journal.renown, c).level;
  // Legend challenges earn extra renown on top of the festival score.
  const earned = Math.round(sc.total * (1 + challengeBonus(s.perks.challenges ?? [], c)));
  const renown = journal.renown + earned;
  const idCounts = { ...journal.idCounts };
  const masteryUps: string[] = [];
  for (const [id, n] of Object.entries(s.stats.identified ?? {})) {
    const before = masteryLevel(idCounts[id] ?? 0, c);
    idCounts[id] = (idCounts[id] ?? 0) + n;
    if (masteryLevel(idCounts[id], c) > before) masteryUps.push(id);
  }
  // An Expert knows a species on sight, and so knows its lookalike too, though it never comes home to fool them.
  const known = Object.keys(idCounts).filter((id) => masteryLevel(idCounts[id], c) >= 2 && c.species[id]?.lookalike);
  return {
    ...journal,
    lookalikes: Array.from(new Set([...journal.lookalikes, ...known])),
    renown,
    idCounts,
    gearOwned: Array.from(new Set([...journal.gearOwned, ...s.gear])),
    years: [
      ...journal.years,
      {
        finished: new Date().toISOString(),
        mode: s.mode,
        seed: s.seed,
        score: sc.total,
        tier: sc.tier?.id ?? null,
        renown: earned,
        levelFrom,
        levelTo: levelFor(renown, c).level,
        masteryUps,
        breakdown,
        board: s.board,
        generation: s.perks.generation,
        challenges: [...(s.perks.challenges ?? [])],
        orders: [...s.orders.filled],
        hybrids: [...s.hybridsMade],
        artifacts: [...(s.artifacts ?? [])],
      },
    ],
    best: Math.max(journal.best, sc.total),
  };
}

/** What the daily calendar shows: each finished daily year by the day it was dealt, and the streaks. */
export interface DailyStats {
  /** Days as "YYYY-MM-DD", from the seed: a daily finished after midnight still belongs to the day it was dealt. */
  byDay: Record<string, YearRecord>;
  /** Days in a row with a finished daily, ending today, or yesterday while today is still unplayed. */
  streak: number;
  longest: number;
  playedToday: boolean;
  /** The first day a daily was finished, or null before any. */
  first: string | null;
}

const DAY = /^daily-(\d{4}-\d{2}-\d{2})$/;

/** The day before a "YYYY-MM-DD" day. Worked in UTC so a clock change can't skip or repeat a day. */
export function dayBefore(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/** `today` is the player's own date as "YYYY-MM-DD", the same date a daily seed carries. */
export function dailyStats(years: YearRecord[], today: string): DailyStats {
  const byDay: Record<string, YearRecord> = {};
  for (const y of years) {
    const m = y.mode === 'daily' ? DAY.exec(y.seed) : null;
    if (m && !byDay[m[1]]) byDay[m[1]] = y;
  }
  const days = Object.keys(byDay).sort();
  let longest = 0;
  let run = 0;
  days.forEach((d, i) => {
    run = i > 0 && dayBefore(d) === days[i - 1] ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  const playedToday = !!byDay[today];
  let streak = 0;
  for (let d = playedToday ? today : dayBefore(today); byDay[d]; d = dayBefore(d)) streak++;
  return { byDay, streak, longest, playedToday, first: days[0] ?? null };
}

/** One month of dailies, `month` as "YYYY-MM": how many were played, their average score (rounded) and the best. */
export function dailyMonth(stats: DailyStats, month: string): { played: number; average: number; best: number } {
  const scores = Object.entries(stats.byDay)
    .filter(([d]) => d.startsWith(`${month}-`))
    .map(([, y]) => y.score);
  return {
    played: scores.length,
    average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    best: scores.length ? Math.max(...scores) : 0,
  };
}
