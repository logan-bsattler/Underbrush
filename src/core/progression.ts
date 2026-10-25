import { content as defaultContent } from './content';
import type { Journal } from './journal';
import type { Content, LevelDef, Perks, Unlock } from './types';

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
export function perksFor(j: Journal, heirlooms: string[], c: Content = defaultContent): Perks {
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
  let bonusCoins = 0;
  let bonusActions = 0;
  let autoHarvest = false;
  for (const u of unlocks) {
    if (u.type === 'farmSize') size = Math.max(size, u.size);
    if (u.type === 'startCoins') bonusCoins += u.amount;
    if (u.type === 'actions') bonusActions += u.amount;
    if (u.type === 'autoHarvest') autoHarvest = true;
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
