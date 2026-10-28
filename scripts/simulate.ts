/**
 * Plays seeded years with the baseline bot and prints pacing numbers,
 * the same things the prototype kit asks playtesters to log.
 *   npm run sim -- 300           single standard-kit years
 *   npm run sim -- 100 campaign  ten-year story campaigns with progression
 *   npm run sim -- 300 gen       Legend years in generations 1 to 4, diving underground carelessly and carefully
 */
import { content, emptyJournal, heirloomChoices, heirloomSlots, levelFor, newGame, perksFor, score, tiersFor, type Journal, type NightReport } from '../src/core';
import { HEIRLOOM_PREFERENCE, playCampaign, playYear } from './bot';

const n = Number(process.argv[2] ?? 300);
const pct = (xs: number[], p: number) => xs.slice().sort((a, b) => a - b)[Math.floor((xs.length - 1) * p)];

if (process.argv[3] === 'gen') {
  // A Legend homestead with every gear owned, in each generation; the last row has every artifact set complete.
  // Each generation with layers open is played twice: diving carelessly, and diving carefully (home after a hazard below).
  const top = content.progression.levels[content.progression.levels.length - 1].renown;
  const rows: [string, Journal][] = [1, 2, 3, 4].map((g) => [`${g}`, { ...emptyJournal(), renown: top, generation: g, gearOwned: content.gear.map((x) => x.id) }]);
  rows.push(['4, full cabinet', { ...rows[3][1], artifacts: content.artifacts.map((a) => a.id) }]);
  console.log(`${n} Legend years per generation with the bot diving underground on every other trip`);
  console.log('generation       bot      bronze  median  p90  tier reached  artifacts  descents  bust rate  falls  actions lost  months away');
  for (const [label, j] of rows) {
    const heirlooms = HEIRLOOM_PREFERENCE.filter((g) => heirloomChoices(j).includes(g)).slice(0, heirloomSlots(levelFor(j.renown).level));
    for (const careful of j.generation > 1 ? [false, true] : [false]) {
      const scores: number[] = [];
      let tiered = 0;
      let artifacts = 0;
      let descents = 0;
      let busts = 0;
      let trips = 0;
      let bronze = 0;
      let falls = 0;
      let lost = 0;
      let away = 0;
      const onNight = (report: NightReport) => {
        for (const e of report.events) if (e.type === 'recovering' && e.actions !== 'month') lost += e.actions;
      };
      for (let i = 0; i < n; i++) {
        const s = playYear(newGame({ seed: `gen-${label}-${i}`, perks: perksFor(j, heirlooms) }), { dive: true, careful, onNight });
        const sc = score(s);
        bronze = tiersFor(s)[0].min;
        scores.push(sc.total);
        if (sc.tier) tiered += 1;
        artifacts += s.artifacts.length;
        descents += s.stats.descents;
        busts += s.stats.busts;
        trips += s.stats.trips;
        falls += s.stats.deepBusts.reduce((a, b) => a + b, 0);
        away += s.stats.monthsAway;
      }
      console.log(
        `${label.padEnd(15)}  ${(careful ? 'careful' : 'dive').padEnd(7)}  ${String(bronze).padStart(6)}  ${String(pct(scores, 0.5)).padStart(6)}  ${String(pct(scores, 0.9)).padStart(3)}  ${`${((100 * tiered) / n).toFixed(0)}%`.padStart(12)}  ${(artifacts / n).toFixed(1).padStart(9)}  ${(descents / n).toFixed(1).padStart(8)}  ${`${((100 * busts) / Math.max(trips, 1)).toFixed(0)}%`.padStart(9)}  ${(falls / n).toFixed(2).padStart(5)}  ${(lost / n).toFixed(1).padStart(12)}  ${(away / n).toFixed(2).padStart(11)}`,
      );
    }
  }
} else if (process.argv[3] === 'campaign') {
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
  console.log(`tend actions per month: ${(tend / n / 12).toFixed(2)} of 4`);
  console.log(`unused actions per year: ${(idle / n).toFixed(1)}`);
  console.log(`bust rate: ${((100 * busts) / Math.max(trips, 1)).toFixed(0)}% of ${(trips / n).toFixed(1)} trips a year`);
  console.log(`hybrids per year: ${(hybrids / n).toFixed(2)}`);
}
