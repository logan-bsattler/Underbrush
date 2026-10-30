import { content as defaultContent } from './content';
import type { Journal } from './journal';
import type { Content, LevelDef, Perks, Unlock } from './types';
import { completedSets, setBonus } from './underground';

/**
 * Progression across years: festival score becomes renown, renown raises the homestead level,
 * and each level unlocks gear in the shop, heirloom slots, a bigger farm or starting coins.
 * Identifying a species again and again builds mastery of it.
 */

export function levelFor(renown: number, c: Content = defaultContent): LevelDef {
  const levels = c.progression.levels;
  return [...levels].reverse().find((l) => renown >= l.renown) ?? levels[0];
}

export function nextLevel(renown: number, c: Content = defaultContent): LevelDef | null {
  return c.progression.levels.find((l) => l.renown > renown) ?? null;
}

/** Every unlock earned up to and including this level. */
export function unlocksThrough(level: number, c: Content = defaultContent): Unlock[] {
  return c.progression.levels.filter((l) => l.level <= level).flatMap((l) => l.unlocks);
}

/** The level whose unlock first stocks this gear, or null if no level does. */
export function gearUnlockLevel(gearId: string, c: Content = defaultContent): LevelDef | null {
  return c.progression.levels.find((l) => l.unlocks.some((u) => u.type === 'gear' && u.id === gearId)) ?? null;
}

/** A Legend has earned every level: they can take on challenges, or pass the homestead on. */
export function isLegend(j: Journal, c: Content = defaultContent): boolean {
  return !nextLevel(j.renown, c);
}

/**
 * Hands the homestead down to the next generation: renown, levels and gear start over, while the
 * field journal, species mastery, achievements and the cabinet of curiosities stay in the family.
 * Each generation starts with a few more coins, faces higher festival tiers, and opens one more
 * layer under every zone.
 */
export function passItOn(j: Journal, c: Content = defaultContent): Journal {
  if (!isLegend(j, c)) throw new Error('Only a Legend of the Valley can pass the homestead on.');
  const generation = j.generation + 1;
  // Lineage achievements are earned the moment the homestead changes hands, not on the next year's first move.
  const lineage = c.achievements.filter((a) => a.check.type === 'generation' && generation >= a.check.count && !j.achievements.includes(a.id));
  return {
    ...j,
    renown: 0,
    gearOwned: [],
    achievements: [...j.achievements, ...lineage.map((a) => a.id)],
    generation,
    lineage: [...j.lineage, { generation: j.generation, renown: j.renown, years: j.years.filter((y) => y.mode === 'story').length }],
  };
}

/** Extra renown this year's challenges earn, as a fraction of the festival score. */
export function challengeBonus(challenges: string[], c: Content = defaultContent): number {
  return challenges.reduce((sum, id) => sum + (c.progression.challenges.find((x) => x.id === id)?.renownBonus ?? 0), 0);
}

export function heirloomSlots(level: number, c: Content = defaultContent): number {
  return unlocksThrough(level, c).filter((u) => u.type === 'heirloomSlot').length;
}

export function masteryLevel(ids: number, c: Content = defaultContent): number {
  return c.progression.mastery.filter((m) => ids >= m.ids).length;
}

/** Gear you may carry into a new year: anything you've owned that the shop now stocks. */
export function heirloomChoices(j: Journal, c: Content = defaultContent): string[] {
  const shop = perksFor(j, [], c).shop;
  return c.gear.map((g) => g.id).filter((id) => j.gearOwned.includes(id) && shop.includes(id));
}

/** What a story year starts with, given the journal and the heirlooms the player packed. */
export function perksFor(j: Journal, heirlooms: string[], c: Content = defaultContent, challenges: string[] = []): Perks {
  const level = levelFor(j.renown, c).level;
  const unlocks = unlocksThrough(level, c);
  const shop = c.gear.map((g) => g.id).filter((id) => unlocks.some((u) => u.type === 'gear' && u.id === id));
  const slots = heirloomSlots(level, c);
  const mastery: Record<string, number> = {};
  for (const [id, n] of Object.entries(j.idCounts)) {
    const m = masteryLevel(n, c);
    if (m > 0) mastery[id] = m;
  }
  let size = c.rules.gridSize;
  const sets = completedSets(j.artifacts, c);
  let bonusCoins = (j.generation - 1) * c.progression.legacy.startCoins + setBonus(sets, 'coins', c);
  let bonusActions = 0;
  let autoHarvest = false;
  let commissions = false;
  for (const u of unlocks) {
    if (u.type === 'farmSize') size = Math.max(size, u.size);
    if (u.type === 'startCoins') bonusCoins += u.amount;
    if (u.type === 'actions') bonusActions += u.amount;
    if (u.type === 'autoHarvest') autoHarvest = true;
    if (u.type === 'commissions') commissions = true;
  }
  return {
    shop,
    heirlooms: heirlooms.filter((id) => shop.includes(id) && j.gearOwned.includes(id)).slice(0, slots),
    mastery,
    bonusCoins,
    bonusActions,
    size,
    autoHarvest,
    spawn: j.discovered.filter((id) => c.species[id]?.kind === 'cultivated'),
    generation: j.generation,
    level,
    challenges: isLegend(j, c) ? challenges.filter((id) => c.progression.challenges.some((x) => x.id === id)) : [],
    sets,
    clues: j.artifacts.length,
    cacheFound: j.cacheFound,
    commissions,
  };
}

/** Farm layouts the homestead can start a story year on. */
export function boardsFor(j: Journal, c: Content = defaultContent): string[] {
  const unlocks = unlocksThrough(levelFor(j.renown, c).level, c);
  return c.boards.map((b) => b.id).filter((id) => unlocks.some((u) => u.type === 'board' && u.id === id));
}

/** The level whose unlock first opens this board, or null if no level does. */
export function boardUnlockLevel(boardId: string, c: Content = defaultContent): LevelDef | null {
  return c.progression.levels.find((l) => l.unlocks.some((u) => u.type === 'board' && u.id === boardId)) ?? null;
}
