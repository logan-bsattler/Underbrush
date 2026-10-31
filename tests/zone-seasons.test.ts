import { describe, expect, it } from 'vitest';
import { content, seasonalName, type Card } from '../src/core';
import { cardTitle, outcomeText } from '../src/ui/text';

const zone = (id: string) => content.zones.find((z) => z.id === id)!;
const printed = (id: string) => new Map(zone(id).deck.flatMap(({ card }) => (card.type === 'ground' || card.type === 'hazard' ? [[card.name, card.type]] : [])));

describe('seasonal names on the forest floor', () => {
  it('renames only hazard and ground cards the zone prints, and only in seasons it is open', () => {
    for (const z of content.zones) {
      const cards = printed(z.id);
      for (const [season, names] of Object.entries(z.seasonNames ?? {})) {
        if (z.seasons) expect(z.seasons, `${z.id} ${season}`).toContain(season);
        for (const name of Object.keys(names!)) expect(cards.has(name), `${z.id}: ${name}`).toBe(true);
      }
    }
  });

  it("never gives a card a name another card in the zone already has that season", () => {
    for (const z of content.zones) {
      for (const season of content.rules.seasons) {
        const shown = [...printed(z.id).keys()].map((name) => seasonalName(name, z.id, season));
        expect(new Set(shown).size, `${z.id} ${season}`).toBe(shown.length);
      }
    }
  });

  it('turns ticks to black ice in winter and leaves the summer floor alone', () => {
    expect(seasonalName('Ticks', 'meadow', 'winter')).toBe('Black Ice');
    expect(seasonalName('Ticks', 'meadow', 'summer')).toBe('Ticks');
    expect(seasonalName('Sudden Rain', 'mixedwoods', 'winter')).toBe('Sleet');
    expect(seasonalName('Ticks', 'burnscar', 'spring')).toBe('Ticks');
  });

  it('keeps the cues to dig by: a truffle tree still says what it is, and the founder’s tree is never renamed', () => {
    const { hosts } = content.rules.dig;
    for (const z of content.zones)
      for (const season of content.rules.seasons)
        for (const host of hosts) if (printed(z.id).has(host)) expect(seasonalName(host, z.id, season)).toContain(host);
    const { cache } = content;
    for (const season of content.rules.seasons) expect(seasonalName(cache.card, cache.zone, season)).toBe(cache.card);
  });

  it('names cards by season on the surface, and by their printed name below it', () => {
    const ticks: Card = { type: 'hazard', name: 'Ticks' };
    const grass: Card = { type: 'ground', name: 'Tall Grass', look: 'brush' };
    const winter = { zone: 'meadow', season: 'winter' as const };
    expect(cardTitle(ticks, winter)).toBe('Black Ice');
    expect(cardTitle(ticks)).toBe('Ticks');
    expect(outcomeText('nothing', grass, undefined, winter)).toBe('Nothing here but frosted grass.');
    expect(outcomeText('nothing', grass)).toBe('Nothing here but tall grass.');
  });
});
