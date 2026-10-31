import { content as defaultContent } from './content';
import { score } from './engine';
import { completedSets } from './underground';
import type { AchievementCheck, Content, GameState } from './types';

/**
 * Achievements are feats the field journal remembers. Each is a check on a year's state, so the
 * engine only records what happened (a zone cleared) and the journal decides what that earns.
 */

/** The year reached this tier or a higher one at the festival. */
function reachedTier(s: GameState, tier: string | null, c: Content): boolean {
  if (!s.over) return false;
  const got = score(s, c).tier;
  if (!got) return false;
  const rank = (id: string) => c.rules.tiers.findIndex((t) => t.id === id);
  return tier === null || rank(got.id) >= rank(tier);
}

/** Artifact sets complete across the cabinet and what this year has brought home. */
export function setsComplete(s: GameState, c: Content = defaultContent): number {
  return completedSets([...s.perks.clues, ...s.artifacts], c).length;
}

function met(check: AchievementCheck, s: GameState, c: Content): boolean {
  switch (check.type) {
    case 'clearZone':
      return check.zone ? s.zonesCleared.includes(check.zone) : s.zonesCleared.length > 0;
    case 'hybrids':
      return s.hybridsMade.length >= check.count;
    case 'orders':
      return s.orders.filled.length >= check.count;
    case 'tier':
      return reachedTier(s, check.tier, c);
    case 'rareFinds':
      return s.stats.rareFinds >= check.count;
    case 'dishes':
      return s.stats.dishes.length >= check.count;
    case 'cleanYear':
      return s.over && s.stats.busts === 0 && s.stats.trips >= check.trips;
    case 'fullFarm':
      return s.grid.every((sq) => sq.tree || sq.species !== null);
    case 'compost':
      return s.stats.compostTiles >= check.count;
    case 'coinsEarned':
      return s.stats.coinsEarned >= check.amount;
    case 'challenges':
      return s.perks.challenges.length >= check.count && reachedTier(s, null, c);
    case 'generation':
      return s.perks.generation >= check.count;
    case 'layer':
      return s.layersReached.some((key) => Number(key.split(':')[1]) >= check.depth);
    case 'artifacts':
      return s.artifacts.length >= check.count;
    case 'cellar':
      return s.cacheFound || s.perks.cacheFound;
    case 'sets':
      return setsComplete(s, c) >= check.count;
    case 'clearLayer':
      return s.layersCleared.length > 0;
  }
}

/** How far this year is toward a counted achievement, or null when it isn't counted (or can't be earned this year). */
export function achievementProgress(check: AchievementCheck, s: GameState): { have: number; need: number } | null {
  switch (check.type) {
    case 'hybrids':
      return { have: s.hybridsMade.length, need: check.count };
    case 'orders':
      return { have: s.orders.filled.length, need: check.count };
    case 'rareFinds':
      return { have: s.stats.rareFinds, need: check.count };
    case 'dishes':
      return { have: s.stats.dishes.length, need: check.count };
    case 'cleanYear':
      return s.stats.busts ? null : { have: s.stats.trips, need: check.trips };
    case 'fullFarm':
      return { have: s.grid.filter((sq) => !sq.tree && sq.species).length, need: s.grid.filter((sq) => !sq.tree).length };
    case 'compost':
      return { have: s.stats.compostTiles, need: check.count };
    case 'coinsEarned':
      return { have: s.stats.coinsEarned, need: check.amount };
    case 'artifacts':
      return s.perks.generation > 1 ? { have: s.artifacts.length, need: check.count } : null;
    default:
      return null;
  }
}

/** Ids of the achievements this year has earned so far. */
export function achievementsEarned(s: GameState, c: Content = defaultContent): string[] {
  return c.achievements.filter((a) => met(a.check, s, c)).map((a) => a.id);
}
