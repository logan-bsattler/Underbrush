import speciesJson from '../data/species.json';
import hybridsJson from '../data/hybrids.json';
import zonesJson from '../data/zones.json';
import gearJson from '../data/gear.json';
import weatherJson from '../data/weather.json';
import ordersJson from '../data/orders.json';
import rulesJson from '../data/rules.json';
import progressionJson from '../data/progression.json';
import type { Content, GearDef, OrderDef, ProgressionDef, RulesDef, SpeciesDef, WeatherDef, ZoneDef } from './types';

/** Builds the content bundle. Everything balance-related lives in src/data so tabletop and app share it. */
export function loadContent(): Content {
  const all = [...(speciesJson as SpeciesDef[]), ...(hybridsJson as SpeciesDef[])];
  const species: Record<string, SpeciesDef> = {};
  for (const s of all) species[s.id] = s;
  return {
    rules: rulesJson as RulesDef,
    progression: progressionJson as ProgressionDef,
    species,
    speciesOrder: all.map((s) => s.id),
    zones: zonesJson as ZoneDef[],
    gear: gearJson as GearDef[],
    weather: weatherJson as WeatherDef[],
    orders: ordersJson as OrderDef[],
  };
}

export const content = loadContent();
