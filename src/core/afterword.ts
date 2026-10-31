import { content as defaultContent } from './content';
import type { Journal } from './journal';
import { hybridUnlockLevel, levelFor } from './progression';
import { layerDef } from './underground';
import type { Content } from './types';

/**
 * The founder's journal, kept once the Founder's Cellar is found: a page of the founder's story for each
 * generation since, notes on the deepest layers, and the parents of every hybrid the family hasn't made.
 * Information only: nothing here scores or changes a rule.
 */

/** The founder's pages read so far: one for the generation that found the cellar and one for each generation since. */
export function afterwordPages(j: Journal, c: Content = defaultContent): string[] {
  if (!j.cacheFound) return [];
  const read = j.generation - (j.cacheGeneration ?? j.generation) + 1;
  return c.cache.afterword.pages.slice(0, Math.max(1, read));
}

export interface BelowNote {
  zone: string;
  depth: number;
  /** The layer's name, e.g. "The Ash Vault". */
  place: string;
  artifact: string;
  /** Whether the family already has it in the cabinet. */
  found: boolean;
  note: string;
  /** The layer's hazards, from its deck, most first. */
  hazards: { name: string; count: number }[];
}

/** The founder's note on each zone's deepest layer: which heirloom lies there and what stands between it and you. */
export function belowNotes(j: Journal, c: Content = defaultContent): BelowNote[] {
  const notes: BelowNote[] = [];
  for (const z of c.zones) {
    const note = c.cache.afterword.below[z.id];
    const depth = c.underground[z.id]?.length ?? 0;
    const layer = layerDef(z.id, depth, c);
    if (!note || !layer) continue;
    const counts = new Map<string, number>();
    for (const { card, copies } of layer.deck) if (card.type === 'hazard') counts.set(card.name, (counts.get(card.name) ?? 0) + copies);
    notes.push({
      zone: z.id,
      depth,
      place: layer.name,
      artifact: layer.artifact,
      found: j.artifacts.includes(layer.artifact),
      note,
      hazards: [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    });
  }
  return notes;
}

/** Hybrids the family has never made and the homestead can cross now, with the two parents the founder names. */
export function pairings(j: Journal, c: Content = defaultContent): { hybrid: string; parents: [string, string] }[] {
  const level = levelFor(j.renown, c).level;
  return c.speciesOrder.flatMap((id) => {
    const sp = c.species[id];
    if (sp.kind !== 'hybrid' || !sp.parents || j.hybrids.includes(id)) return [];
    if ((hybridUnlockLevel(id, c)?.level ?? 0) > level) return [];
    return [{ hybrid: id, parents: sp.parents }];
  });
}
