import { content as defaultContent } from './content';
import { score } from './engine';
import { levelFor, masteryLevel } from './progression';
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
}

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
}

export function emptyJournal(): Journal {
  return { version: 1, discovered: [], lookalikes: [], hybrids: [], years: [], best: 0, renown: 0, idCounts: {}, gearOwned: [] };
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
  return { ...base, ...j, years, version: 1 };
}

/** Folds this year's finds into the journal. Returns the ids that are new to it. */
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
  };
  return { journal, fresh };
}

/** Records a finished year once (keyed by seed): renown, mastery and gear carry forward. */
export function recordYear(j: Journal, s: GameState, c: Content = defaultContent): Journal {
  const { journal } = mergeDiscoveries(j, s);
  if (journal.years.some((y) => y.seed === s.seed)) return journal;
  const sc = score(s, c);
  const levelFrom = levelFor(journal.renown, c).level;
  const renown = journal.renown + sc.total;
  const idCounts = { ...journal.idCounts };
  const masteryUps: string[] = [];
  for (const [id, n] of Object.entries(s.stats.identified ?? {})) {
    const before = masteryLevel(idCounts[id] ?? 0, c);
    idCounts[id] = (idCounts[id] ?? 0) + n;
    if (masteryLevel(idCounts[id], c) > before) masteryUps.push(id);
  }
  return {
    ...journal,
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
        renown: sc.total,
        levelFrom,
        levelTo: levelFor(renown, c).level,
        masteryUps,
      },
    ],
    best: Math.max(journal.best, sc.total),
  };
}
