/**
 * Plays many seeded years with the baseline bot and prints pacing numbers,
 * the same things the prototype kit asks playtesters to log.
 *   npm run sim -- 500
 */
import { newGame, score } from '../src/core';
import { playYear } from './bot';

const n = Number(process.argv[2] ?? 300);
const tiers: Record<string, number> = {};
let total = 0;
let tend = 0;
let idle = 0;
let busts = 0;
let hybrids = 0;
let trips = 0;
const scores: number[] = [];

for (let i = 0; i < n; i++) {
  const s = playYear(newGame({ seed: `sim-${i}` }));
  const sc = score(s);
  scores.push(sc.total);
  total += sc.total;
  tiers[sc.tier?.name ?? 'None'] = (tiers[sc.tier?.name ?? 'None'] ?? 0) + 1;
  tend += s.stats.tendActions.reduce((a, b) => a + b, 0);
  idle += s.stats.idleActions.reduce((a, b) => a + b, 0);
  busts += s.stats.busts;
  trips += s.stats.trips;
  hybrids += s.hybridsMade.length;
}

scores.sort((a, b) => a - b);
const pct = (p: number) => scores[Math.floor((scores.length - 1) * p)];
console.log(`${n} years with the baseline bot`);
console.log(`score: mean ${(total / n).toFixed(1)}, p10 ${pct(0.1)}, median ${pct(0.5)}, p90 ${pct(0.9)}`);
console.log(`tiers: ${Object.entries(tiers).map(([k, v]) => `${k} ${((100 * v) / n).toFixed(0)}%`).join(', ')}`);
console.log(`tend actions per week: ${(tend / n / 12).toFixed(2)} of 4`);
console.log(`unused actions per year: ${(idle / n).toFixed(1)}`);
console.log(`bust rate: ${((100 * busts) / Math.max(trips, 1)).toFixed(0)}% of ${(trips / n).toFixed(1)} trips a year`);
console.log(`hybrids per year: ${(hybrids / n).toFixed(2)}`);
