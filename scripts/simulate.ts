/**
 * Plays seeded years with the baseline bot and prints pacing numbers,
 * the same things the prototype kit asks playtesters to log.
 *   npm run sim -- 300           single standard-kit years
 *   npm run sim -- 100 campaign  ten-year story campaigns with progression
 */
import { emptyJournal, levelFor, newGame, score } from '../src/core';
import { playCampaign, playYear } from './bot';

const n = Number(process.argv[2] ?? 300);
const pct = (xs: number[], p: number) => xs.slice().sort((a, b) => a - b)[Math.floor((xs.length - 1) * p)];

if (process.argv[3] === 'campaign') {
  const YEARS = 10;
  const byYear: { score: number[]; level: number[]; size: number[] }[] = Array.from({ length: YEARS }, () => ({ score: [], level: [], size: [] }));
  for (let i = 0; i < n; i++) {
    const { games } = playCampaign(YEARS, `camp-${i}`, emptyJournal());
    let renown = 0;
    games.forEach((g, y) => {
      const sc = score(g).total;
      byYear[y].score.push(sc);
      byYear[y].level.push(levelFor(renown).level);
      byYear[y].size.push(g.size);
      renown += sc;
    });
  }
  console.log(`${n} ten-year campaigns with the baseline bot (level is at the start of the year)`);
  console.log('year  level  median score  p90  5x5 farms');
  byYear.forEach((r, y) => {
    const lvl = r.level.reduce((a, b) => a + b, 0) / n;
    const big = r.size.filter((x) => x > 4).length / n;
    console.log(`${String(y + 1).padStart(4)}  ${lvl.toFixed(1).padStart(5)}  ${String(pct(r.score, 0.5)).padStart(12)}  ${String(pct(r.score, 0.9)).padStart(3)}  ${(100 * big).toFixed(0).padStart(8)}%`);
  });
} else {
  const tiers: Record<string, number> = {};
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
    tiers[sc.tier?.name ?? 'None'] = (tiers[sc.tier?.name ?? 'None'] ?? 0) + 1;
    tend += s.stats.tendActions.reduce((a, b) => a + b, 0);
    idle += s.stats.idleActions.reduce((a, b) => a + b, 0);
    busts += s.stats.busts;
    trips += s.stats.trips;
    hybrids += s.hybridsMade.length;
  }
  const mean = scores.reduce((a, b) => a + b, 0) / n;
  console.log(`${n} years with the baseline bot`);
  console.log(`score: mean ${mean.toFixed(1)}, p10 ${pct(scores, 0.1)}, median ${pct(scores, 0.5)}, p90 ${pct(scores, 0.9)}`);
  console.log(`tiers: ${Object.entries(tiers).map(([k, v]) => `${k} ${((100 * v) / n).toFixed(0)}%`).join(', ')}`);
  console.log(`tend actions per week: ${(tend / n / 12).toFixed(2)} of 4`);
  console.log(`unused actions per year: ${(idle / n).toFixed(1)}`);
  console.log(`bust rate: ${((100 * busts) / Math.max(trips, 1)).toFixed(0)}% of ${(trips / n).toFixed(1)} trips a year`);
  console.log(`hybrids per year: ${(hybrids / n).toFixed(2)}`);
}
