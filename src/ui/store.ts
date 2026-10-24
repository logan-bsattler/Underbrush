import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
  dispatch as apply,
  emptyJournal,
  GameError,
  mergeDiscoveries,
  newGame,
  recordYear,
  type Action,
  type ActionResult,
  type GameState,
  type Journal,
} from '../core';

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
  return s && s.version === 1 ? s : null;
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
  act: (a: Action) => ActionResult | null;
  start: (mode: GameState['mode']) => void;
  clearError: () => void;
}

export function useStore(): Store {
  const [game, setGame] = useState<GameState | null>(() => loadSave());
  const [journal, setJournal] = useState<Journal>(() => read<Journal>(JOURNAL_KEY) ?? emptyJournal());
  const [freshThisYear, setFresh] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<ActionResult | null>(null);
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
        return result;
      } catch (e) {
        if (e instanceof GameError) {
          setError(e.message);
          return null;
        }
        throw e;
      }
    },
    [commit],
  );

  const start = useCallback(
    (mode: GameState['mode']) => {
      const g = newGame(mode === 'daily' ? { mode, seed: dailySeed() } : { mode });
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

  return { game, journal, freshThisYear, error, last, act, start, clearError: () => setError(null) };
}
