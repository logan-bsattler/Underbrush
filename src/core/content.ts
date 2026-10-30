import speciesJson from '../data/species.json';
import hybridsJson from '../data/hybrids.json';
import zonesJson from '../data/zones.json';
import gearJson from '../data/gear.json';
import weatherJson from '../data/weather.json';
import ordersJson from '../data/orders.json';
import commissionsJson from '../data/commissions.json';
import rulesJson from '../data/rules.json';
import progressionJson from '../data/progression.json';
import boardsJson from '../data/boards.json';
import recipesJson from '../data/recipes.json';
import achievementsJson from '../data/achievements.json';
import undergroundJson from '../data/underground.json';
import artifactsJson from '../data/artifacts.json';
import type {
  AchievementDef,
  ArtifactDef,
  ArtifactSetDef,
  BoardDef,
  CacheDef,
  Content,
  GearDef,
  LayerDef,
  OrderDef,
  ProgressionDef,
  RecipeDef,
  RulesDef,
  SpeciesDef,
  WeatherDef,
  ZoneDef,
} from './types';

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
    commissions: commissionsJson as OrderDef[],
    boards: boardsJson as BoardDef[],
    recipes: recipesJson as unknown as RecipeDef[],
    achievements: achievementsJson as AchievementDef[],
    underground: undergroundJson as Record<string, LayerDef[]>,
    artifacts: artifactsJson.artifacts as ArtifactDef[],
    artifactSets: artifactsJson.sets as ArtifactSetDef[],
    cache: artifactsJson.cache as CacheDef,
  };
}

export const content = loadContent();
