import { content as defaultContent } from './content';
import type { ArtifactDef, Card, Content, LayerDef } from './types';

/**
 * The underground. Every generation after the first opens one more layer below every zone; a trip
 * descends into one from the zone's deep patches. Each layer is a small deck of its own with more
 * hazards the further down it is, and holds one artifact. Artifacts fill sets in the field journal's
 * cabinet, and a full set brings a small perk to every story year after.
 */

/** A layer's key in the year's decks and in the layers reached: "zone:depth". */
export function layerKey(zone: string, depth: number): string {
  return `${zone}:${depth}`;
}

/** How many layers below a zone a generation can reach: none for the first, then one more for each generation. */
export function layersOpen(generation: number, zone: string, c: Content = defaultContent): number {
  return Math.max(0, Math.min(generation - 1, c.underground[zone]?.length ?? 0));
}

export function layerDef(zone: string, depth: number, c: Content = defaultContent): LayerDef | null {
  return c.underground[zone]?.[depth - 1] ?? null;
}

export function buildLayerDeck(layer: LayerDef): Card[] {
  const cards: Card[] = [];
  for (const entry of layer.deck) for (let i = 0; i < entry.copies; i++) cards.push({ ...entry.card });
  return cards;
}

export function artifactDef(id: string, c: Content = defaultContent): ArtifactDef | null {
  return c.artifacts.find((a) => a.id === id) ?? null;
}

/** The zone and depth whose layer an artifact lies in. */
export function artifactHome(id: string, c: Content = defaultContent): { zone: string; depth: number } | null {
  for (const [zone, layers] of Object.entries(c.underground)) {
    const at = layers.findIndex((l) => l.artifact === id);
    if (at >= 0) return { zone, depth: at + 1 };
  }
  return null;
}

/** Sets with every artifact in the cabinet. */
export function completedSets(cabinet: string[], c: Content = defaultContent): string[] {
  return c.artifactSets.filter((set) => c.artifacts.filter((a) => a.set === set.id).every((a) => cabinet.includes(a.id))).map((set) => set.id);
}

/** How much the complete sets add to one kind of effect (0 when none of them does). */
export function setBonus(sets: string[], type: 'coins' | 'points' | 'keep' | 'basket', c: Content = defaultContent): number {
  let n = 0;
  for (const id of sets) {
    const e = c.artifactSets.find((x) => x.id === id)?.effect;
    if (e && e.type === type) n += e.amount;
  }
  return n;
}

export function hasSetEffect(sets: string[], type: 'glint' | 'shortcut', c: Content = defaultContent): boolean {
  return sets.some((id) => c.artifactSets.find((x) => x.id === id)?.effect.type === type);
}

/** The family's hint at what lies below a zone: the first layer this generation can't reach yet. Null once every layer is open. */
export function nextClue(generation: number, zone: string, c: Content = defaultContent): { depth: number; layer: LayerDef } | null {
  const depth = layersOpen(generation, zone, c) + 1;
  const layer = layerDef(zone, depth, c);
  return layer ? { depth, layer } : null;
}

/** The lore told as a generation begins: the clue to one of the layers it has just opened (progression.legacy.lore names the zone). */
export function generationLore(generation: number, c: Content = defaultContent): { zone: string; depth: number; layer: LayerDef } | null {
  if (generation < 2) return null;
  const depth = generation - 1;
  const zones = c.zones.map((z) => z.id).filter((id) => layerDef(id, depth, c));
  if (!zones.length) return null;
  const named = c.progression.legacy.lore[generation - 2];
  const zone = named && zones.includes(named) ? named : zones[(generation - 2) % zones.length];
  return { zone, depth, layer: layerDef(zone, depth, c)! };
}
