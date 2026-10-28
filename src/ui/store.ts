import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
  dispatch as apply,
  GameError,
  mergeDiscoveries,
  migrateState,
  newGame,
  normalizeJournal,
  passItOn as handDown,
  perksFor,
  recordYear,
  standardPerks,
  type Action,
  type ActionResult,
  type GameState,
  type Journal,
} from '../core';
import { play, soundFor } from './sound';

const SAVE_KEY = 'underbrush:save:v1';
const JOURNAL_KEY = 'underbrush:journal:v1';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or blocked (private mode); the game still plays, it just won't resume.
  }
}

export function loadSave(): GameState | null {
  const s = read<GameState>(SAVE_KEY);
  return s && s.version === 1 ? migrateState(s) : null;
}

/** Drops the current year's save (the journal is kept). */
export function clearSave() {
  write(SAVE_KEY, null);
}

export function dailySeed(d = new Date()) {
  return `daily-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface Store {
  game: GameState | null;
  journal: Journal;
  /** Journal ids first discovered this year, for "New!" badges. */
  freshThisYear: string[];
  error: string | null;
  last: ActionResult | null;
  /** Achievement ids earned since the player last dismissed the notice. */
  achieved: string[];
  dismissAchieved: () => void;
  /** Family lore paid off since the player last dismissed it: "layer:zone:depth" for a layer first reached, "set:id" for a set just completed. */
  lore: string[];
  dismissLore: () => void;
  act: (a: Action) => ActionResult | null;
  /** Starts a year. Story years bring the homestead's progression, the packed heirlooms, the chosen board and any Legend challenges; daily years use the standard kit on the day's board. */
  start: (mode: GameState['mode'], heirlooms?: string[], board?: string, challenges?: string[]) => void;
  /** Hands the homestead down to the next generation. */
  passItOn: () => void;
  clearError: () => void;
}

export function useStore(): Store {
  const [game, setGame] = useState<GameState | null>(() => loadSave());
  const [journal, setJournal] = useState<Journal>(() => normalizeJournal(read<Journal>(JOURNAL_KEY)));
  const [freshThisYear, setFresh] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<ActionResult | null>(null);
  const [achieved, setAchieved] = useState<string[]>([]);
  const [lore, setLore] = useState<string[]>([]);
  const gameRef = useRef(game);
  gameRef.current = game;
  const journalRef = useRef(journal);
  journalRef.current = journal;

  const commit = useCallback((next: GameState) => {
    gameRef.current = next;
    setGame(next);
    write(SAVE_KEY, next);
    const merged = mergeDiscoveries(journalRef.current, next);
    let j = merged.journal;
    if (next.over) j = recordYear(j, next);
    if (merged.fresh.length || next.over) {
      journalRef.current = j;
      setJournal(j);
      write(JOURNAL_KEY, j);
      if (merged.fresh.length) setFresh((f) => [...f, ...merged.fresh]);
      const won = merged.fresh.filter((f) => f.startsWith('achievement:')).map((f) => f.slice('achievement:'.length));
      if (won.length) setAchieved((a) => [...a, ...won]);
      const told = merged.fresh.filter((f) => f.startsWith('layer:') || f.startsWith('set:'));
      if (told.length) setLore((l) => [...l, ...told]);
    }
  }, []);

  const act = useCallback(
    (a: Action) => {
      const cur = gameRef.current;
      if (!cur) return null;
      try {
        const { state, result } = apply(cur, a);
        commit(state);
        setLast(result);
        setError(null);
        const cue = soundFor(a, result, state);
        if (cue) play(cue.sfx, cue.n);
        return result;
      } catch (e) {
        if (e instanceof GameError) {
          play('nope');
          setError(e.message);
          return null;
        }
        throw e;
      }
    },
    [commit],
  );

  const start = useCallback(
    (mode: GameState['mode'], heirlooms: string[] = [], board?: string, challenges: string[] = []) => {
      const g =
        mode === 'daily'
          ? newGame({ mode, seed: dailySeed(), perks: standardPerks() })
          : newGame({ mode, board, perks: perksFor(journalRef.current, heirlooms, undefined, challenges) });
      setFresh([]);
      setLast(null);
      commit(g);
    },
    [commit],
  );

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 3200);
    return () => clearTimeout(t);
  }, [error]);

  const passItOn = useCallback(() => {
    const before = journalRef.current.achievements;
    const j = handDown(journalRef.current);
    const won = j.achievements.filter((id) => !before.includes(id));
    if (won.length) setAchieved((a) => [...a, ...won]);
    journalRef.current = j;
    setJournal(j);
    write(JOURNAL_KEY, j);
  }, []);

  useEffect(() => {
    if (!achieved.length) return;
    const t = setTimeout(() => setAchieved([]), 5000);
    return () => clearTimeout(t);
  }, [achieved]);

  // Lore is longer to read than an achievement's name, so it stays up a little longer.
  useEffect(() => {
    if (!lore.length) return;
    const t = setTimeout(() => setLore([]), 8000);
    return () => clearTimeout(t);
  }, [lore]);

  return {
    game,
    journal,
    freshThisYear,
    error,
    last,
    achieved,
    dismissAchieved: () => setAchieved([]),
    lore,
    dismissLore: () => setLore([]),
    act,
    start,
    passItOn,
    clearError: () => setError(null),
  };
}
