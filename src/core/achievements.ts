import { content as defaultContent } from './content';
import type { AchievementCheck, Content, GameState } from './types';

/**
 * Achievements are feats the field journal remembers. Each is a check on a year's state, so the
 * engine only records what happened (a zone cleared) and the journal decides what that earns.
 */

function met(check: AchievementCheck, s: GameState): boolean {
  switch (check.type) {
    case 'clearZone':
      return check.zone ? s.zonesCleared.includes(check.zone) : s.zonesCleared.length > 0;
  }
}

/** Ids of the achievements this year has earned so far. */
export function achievementsEarned(s: GameState, c: Content = defaultContent): string[] {
  return c.achievements.filter((a) => met(a.check, s)).map((a) => a.id);
}
