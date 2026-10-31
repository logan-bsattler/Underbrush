/**
 * Plays seeded years with the baseline bot and prints pacing numbers,
 * the same things the prototype kit asks playtesters to log.
 *   npm run sim -- 300           single standard-kit years
 *   npm run sim -- 100 campaign  ten-year story campaigns with progression
 *   npm run sim -- 20 plan 30    thirty-year story campaigns with the planner bot, by homestead level
 *   npm run sim -- 300 gen       Legend years in generations 1 to 4, diving underground carelessly and carefully
 *   npm run sim -- 20 truffle 30 thirty-year planner campaigns without the Spade, digging on the way home, and hunting truffles
 *   npm run sim -- 20 feast 30   thirty-year planner campaigns, as usual and going after the makings of points dishes
 *   npm run sim -- 50 cache 60   sixty-year sagas with a careful planner that passes the homestead on and digs the Founder's Cache on schedule
 */
import { cacheMarks, content, emptyJournal, isLegend, passItOn, recordYear, heirloomChoices, heirloomSlots, levelFor, newGame, perksFor, score, tiersFor, type GameState, type Journal, type NightReport } from '../src/core';
import { HEIRLOOM_PREFERENCE, playCampaign, playYear, RARE_GEAR } from './bot';

const n = Number(process.argv[2] ?? 300);
const pct = (xs: number[], p: number) => xs.slice().sort((a, b) => a - b)[Math.floor((xs.length - 1) * p)];

if (process.argv[3] === 'cache') {
  // Whole sagas: the planner dives carefully, passes the homestead on as soon as it's a Legend, and digs the
  // Founder's Cache the first winter it has every mark, a Spade and the Hollow open.
  const YEARS = Number(process.argv[4] ?? 60);
  const { cache } = content;
  type Saga = { found: number | null; generation: number; marked: number | null; level: number; share: number; renown: number; cacheRenown: number };
  const sagas: Saga[] = [];
  for (let i = 0; i < n; i++) {
    let j = emptyJournal();
    const saga: Saga = { found: null, generation: 0, marked: null, level: 0, share: 0, renown: 0, cacheRenown: 0 };
    for (let y = 0; y < YEARS; y++) {
      if (isLegend(j)) j = passItOn(j);
      const level = levelFor(j.renown).level;
      const heirlooms = HEIRLOOM_PREFERENCE.filter((g) => heirloomChoices(j).includes(g)).slice(0, heirloomSlots(level));
      const start = newGame({ seed: `cache-${i}-y${y}`, perks: perksFor(j, heirlooms) });
      if (saga.marked === null && cacheMarks(start).length === 3) saga.marked = y + 1;
      const s = playYear(start, { plan: true, dive: true, careful: true, cache: true });
      j = recordYear(j, s);
      const sc = score(s);
      saga.renown += sc.total;
      if (s.cacheFound) {
        Object.assign(saga, { found: y + 1, generation: j.generation, level, share: sc.cache / sc.total });
        saga.cacheRenown += sc.cache;
      }
    }
    sagas.push(saga);
  }
  const found = sagas.filter((x) => x.found !== null);
  const marked = sagas.filter((x) => x.marked !== null);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const spread = (xs: number[]) => (xs.length ? `median ${pct(xs, 0.5)}, p10 ${pct(xs, 0.1)}, p90 ${pct(xs, 0.9)}` : '-');
  console.log(`${n} sagas of ${YEARS} years with a careful diving planner; the cache is under the ${cache.card} in ${cache.zone}, in ${cache.season}, for ${cache.points} points`);
  console.log(`  every mark in at the start of a year: ${((100 * marked.length) / n).toFixed(0)}% of sagas; year ${spread(marked.map((x) => x.marked!))}`);
  console.log(`  cellar found: ${((100 * found.length) / n).toFixed(0)}% of sagas; year ${spread(found.map((x) => x.found!))}`);
  console.log(`  years from every mark to the cellar: ${spread(found.filter((x) => x.marked !== null).map((x) => x.found! - x.marked!))}`);
  const gens = [...new Set(found.map((x) => x.generation))].sort((a, b) => a - b);
  console.log(`  found in generation: ${gens.map((g) => `${g}: ${found.filter((x) => x.generation === g).length}`).join(', ') || '-'}; homestead level then: ${spread(found.map((x) => x.level))}`);
  console.log(`  share of that year's score: ${(100 * mean(found.map((x) => x.share))).toFixed(0)}%; share of the saga's renown: ${(100 * mean(found.map((x) => x.cacheRenown / x.renown))).toFixed(1)}%`);
} else if (process.argv[3] === 'truffle') {
  // Story campaigns with the planner, played on the same seeds without the Spade, digging only on the way home,
  // and hunting oak and hazel in winter; read by the homestead level at the start of each year, from the Spade's level on.
  const YEARS = Number(process.argv[4] ?? 30);
  const truffle = content.species[content.rules.dig.species];
  const from = content.progression.levels.findIndex((l) => l.unlocks.some((u) => u.type === 'gear' && u.id === 'spade')) + 1;
  console.log(`${n} planner campaigns of ${YEARS} years per Spade setting; truffles at ${truffle.value} coins, a ${content.rules.dig.chance} chance under ${content.rules.dig.hosts.join(' or ')} in winter`);
  console.log('level  spade  years  median  mean   spade owned  digs/yr  truffles/yr  hit rate  truffle coins/yr');
  const rows: Record<string, { score: number[]; owned: number; digs: number; truffles: number }> = {};
  for (const spade of [undefined, 'exit', 'hunt'] as const) {
    for (let i = 0; i < n; i++) {
      let j = emptyJournal();
      for (let y = 0; y < YEARS; y++) {
        const level = levelFor(j.renown).level;
        const heirlooms = HEIRLOOM_PREFERENCE.filter((g) => heirloomChoices(j).includes(g)).slice(0, heirloomSlots(level));
        const r = (rows[`${level}:${spade ?? 'none'}`] ??= { score: [], owned: 0, digs: 0, truffles: 0 });
        const s = playYear(newGame({ seed: `truffle-${i}-y${y}`, perks: perksFor(j, heirlooms) }), {
          plan: true,
          spade,
          onResult: (_a, res) => {
            if (res.kind !== 'dig') return;
            r.digs += 1;
            if (res.dug === 'truffle') r.truffles += 1;
          },
        });
        j = recordYear(j, s);
        r.score.push(score(s).total);
        if (s.gear.includes('spade')) r.owned += 1;
      }
    }
  }
  for (let level = from; level <= content.progression.levels.length; level++) {
    for (const spade of ['none', 'exit', 'hunt']) {
      const r = rows[`${level}:${spade}`];
      if (!r) continue;
      const y = r.score.length;
      const mean = r.score.reduce((a, b) => a + b, 0) / y;
      console.log(
        `${`L${level}`.padEnd(5)}  ${spade.padEnd(5)}  ${String(y).padStart(5)}  ${String(pct(r.score, 0.5)).padStart(6)}  ${mean.toFixed(1).padStart(5)}  ${`${((100 * r.owned) / y).toFixed(0)}%`.padStart(11)}  ${(r.digs / y).toFixed(2).padStart(7)}  ${(r.truffles / y).toFixed(2).padStart(11)}  ${`${r.digs ? ((100 * r.truffles) / r.digs).toFixed(0) : '-'}%`.padStart(8)}  ${((r.truffles * truffle.value) / y).toFixed(1).padStart(16)}`,
      );
    }
  }
} else if (process.argv[3] === 'feast') {
  // Story campaigns with the planner, played on the same seeds as usual and going after the makings of points dishes,
  // with the gear for their zones as heirlooms first; read by the homestead level at the start of each year.
  const YEARS = Number(process.argv[4] ?? 30);
  const feasts = content.recipes.filter((r) => r.effect.type === 'points');
  console.log(`${n} planner campaigns of ${YEARS} years per style; points dishes: ${feasts.map((r) => r.name).join(', ')}`);
  console.log(`level  style  years  median  tiers now  Golden  feast points/yr  ${feasts.map((r) => `${r.id}/yr`).join('  ')}`);
  const golden = content.rules.tiers[content.rules.tiers.length - 1].id;
  const rows: Record<string, { score: number[]; tier: number; top: number; feast: number; cooked: Record<string, number> }> = {};
  for (const rare of [false, true]) {
    const preference = rare ? [...RARE_GEAR, ...HEIRLOOM_PREFERENCE.filter((g) => !RARE_GEAR.includes(g))] : HEIRLOOM_PREFERENCE;
    for (let i = 0; i < n; i++) {
      let j = emptyJournal();
      for (let y = 0; y < YEARS; y++) {
        const level = levelFor(j.renown).level;
        const heirlooms = preference.filter((g) => heirloomChoices(j).includes(g)).slice(0, heirloomSlots(level));
        const r = (rows[`${level}:${rare ? 'rare' : 'usual'}`] ??= { score: [], tier: 0, top: 0, feast: 0, cooked: {} });
        const s = playYear(newGame({ seed: `feast-${i}-y${y}`, perks: perksFor(j, heirlooms) }), {
          plan: true,
          rare,
          onResult: (a) => {
            if (a.type === 'cook') r.cooked[a.recipe] = (r.cooked[a.recipe] ?? 0) + 1;
          },
        });
        j = recordYear(j, s);
        const sc = score(s);
        r.score.push(sc.total);
        if (sc.tier) r.tier += 1;
        if (sc.tier?.id === golden) r.top += 1;
        r.feast += sc.feast;
      }
    }
  }
  for (let level = 1; level <= content.progression.levels.length; level++) {
    for (const style of ['usual', 'rare']) {
      const r = rows[`${level}:${style}`];
      if (!r) continue;
      const y = r.score.length;
      console.log(
        `${`L${level}`.padEnd(5)}  ${style.padEnd(5)}  ${String(y).padStart(5)}  ${String(pct(r.score, 0.5)).padStart(6)}  ${`${((100 * r.tier) / y).toFixed(0)}%`.padStart(9)}  ${`${((100 * r.top) / y).toFixed(0)}%`.padStart(6)}  ${(r.feast / y).toFixed(2).padStart(15)}  ${feasts.map((d) => ((r.cooked[d.id] ?? 0) / y).toFixed(2).padStart(d.id.length + 3)).join('  ')}`,
      );
    }
  }
} else if (process.argv[3] === 'gen') {
  // A Legend homestead with every gear owned, in each generation; the last row has every artifact set complete.
  // Each generation with layers open is played three ways: diving carelessly, diving carefully (home after a hazard
  // below), and by the planner diving carefully; generation 1 has no layers, so only carelessly and by the planner.
  const top = content.progression.levels[content.progression.levels.length - 1].renown;
  const rows: [string, Journal][] = [1, 2, 3, 4].map((g) => [`${g}`, { ...emptyJournal(), renown: top, generation: g, gearOwned: content.gear.map((x) => x.id) }]);
  rows.push(['4, full cabinet', { ...rows[3][1], artifacts: content.artifacts.map((a) => a.id) }]);
  console.log(`${n} Legend years per generation with the bot diving underground on every other trip`);
  console.log('generation       bot      bronze  median  p90  tier reached  top tier  artifacts  artifact pts  descents  bust rate  falls  actions lost  months away');
  for (const [label, j] of rows) {
    const heirlooms = HEIRLOOM_PREFERENCE.filter((g) => heirloomChoices(j).includes(g)).slice(0, heirloomSlots(levelFor(j.renown).level));
    for (const bot of j.generation > 1 ? (['dive', 'careful', 'planner'] as const) : (['dive', 'planner'] as const)) {
      const careful = bot !== 'dive';
      const scores: number[] = [];
      let tiered = 0;
      let top = 0;
      let artifacts = 0;
      let artifactPoints = 0;
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
        const s = playYear(newGame({ seed: `gen-${label}-${i}`, perks: perksFor(j, heirlooms) }), { dive: true, careful, plan: bot === 'planner', onNight });
        const sc = score(s);
        bronze = tiersFor(s)[0].min;
        scores.push(sc.total);
        if (sc.tier) tiered += 1;
        if (sc.tier?.id === content.rules.tiers[content.rules.tiers.length - 1].id) top += 1;
        artifacts += s.artifacts.length;
        artifactPoints += sc.artifacts;
        descents += s.stats.descents;
        busts += s.stats.busts;
        trips += s.stats.trips;
        falls += s.stats.deepBusts.reduce((a, b) => a + b, 0);
        away += s.stats.monthsAway;
      }
      console.log(
        `${label.padEnd(15)}  ${bot.padEnd(7)}  ${String(bronze).padStart(6)}  ${String(pct(scores, 0.5)).padStart(6)}  ${String(pct(scores, 0.9)).padStart(3)}  ${`${((100 * tiered) / n).toFixed(0)}%`.padStart(12)}  ${`${((100 * top) / n).toFixed(0)}%`.padStart(8)}  ${(artifacts / n).toFixed(1).padStart(9)}  ${(artifactPoints / n).toFixed(1).padStart(12)}  ${(descents / n).toFixed(1).padStart(8)}  ${`${((100 * busts) / Math.max(trips, 1)).toFixed(0)}%`.padStart(9)}  ${(falls / n).toFixed(2).padStart(5)}  ${(lost / n).toFixed(1).padStart(12)}  ${(away / n).toFixed(2).padStart(11)}`,
      );
    }
  }
} else if (process.argv[3] === 'plan') {
  // Long story campaigns with the planner, which chases orders, read by the homestead level at the start of each year.
  const YEARS = Number(process.argv[4] ?? 30);
  const rows: Record<number, { score: number[]; tier: number; orders: number; left: number[]; earned: number[]; hires: number; taken: number; done: number; hybrids: number; gated: number }> = {};
  const gated = (id: string) => content.progression.levels.some((l) => l.unlocks.some((u) => u.type === 'hybrid' && u.id === id));
  for (let i = 0; i < n; i++) {
    let j = emptyJournal();
    for (let y = 0; y < YEARS; y++) {
      const level = levelFor(j.renown).level;
      const heirlooms = HEIRLOOM_PREFERENCE.filter((g) => heirloomChoices(j).includes(g)).slice(0, heirloomSlots(level));
      const s = playYear(newGame({ seed: `plan-${i}-y${y}`, perks: perksFor(j, heirlooms) }), { plan: true });
      j = recordYear(j, s);
      const sc = score(s);
      const r = (rows[level] ??= { score: [], tier: 0, orders: 0, left: [], earned: [], hires: 0, taken: 0, done: 0, hybrids: 0, gated: 0 });
      r.score.push(sc.total);
      if (sc.tier) r.tier += 1;
      r.orders += s.orders.filled.length;
      r.left.push(s.coins);
      r.earned.push(s.stats.coinsEarned);
      r.hires += s.hires;
      r.taken += s.commission.taken;
      r.done += s.orders.filled.filter((id) => id.startsWith('c-')).length;
      r.hybrids += s.hybridsMade.length;
      r.gated += s.hybridsMade.filter(gated).length;
    }
  }
  console.log(`${n} ${YEARS}-year campaigns with the planner, by level at the start of the year`);
  console.log('level  years  median  p90  tiers now  orders/yr  hires/yr  coins left (median, p90)  coins earned (median)  commissions taken, delivered /yr  hybrids/yr (level-gated)');
  for (const [level, r] of Object.entries(rows)) {
    const k = r.score.length;
    console.log(
      `${level.padStart(5)}  ${String(k).padStart(5)}  ${String(pct(r.score, 0.5)).padStart(6)}  ${String(pct(r.score, 0.9)).padStart(3)}  ${`${((100 * r.tier) / k).toFixed(0)}%`.padStart(9)}  ${(r.orders / k).toFixed(1).padStart(9)}  ${(r.hires / k).toFixed(1).padStart(8)}  ${`${pct(r.left, 0.5)}, ${pct(r.left, 0.9)}`.padStart(24)}  ${String(pct(r.earned, 0.5)).padStart(21)}  ${(r.taken / k).toFixed(1)}, ${(r.done / k).toFixed(1)}  ${(r.hybrids / k).toFixed(2).padStart(31)} (${(r.gated / k).toFixed(2)})`,
    );
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
  // The baseline bot, then a bot that spends the year foraging rather than farming: as a new player,
  // and as a Legend with every gear (every zone open) in the first generation.
  const top = content.progression.levels[content.progression.levels.length - 1].renown;
  const legend: Journal = { ...emptyJournal(), renown: top, gearOwned: content.gear.map((x) => x.id) };
  const legendHeirlooms = HEIRLOOM_PREFERENCE.filter((g) => heirloomChoices(legend).includes(g)).slice(0, heirloomSlots(levelFor(top).level));
  const runs: [string, (i: number) => GameState][] = [
    ['the baseline bot', (i) => playYear(newGame({ seed: `sim-${i}` }))],
    ['the baseline bot, swapping when stuck', (i) => playYear(newGame({ seed: `sim-${i}` }), { swap: true })],
    ['a bot that mostly forages', (i) => playYear(newGame({ seed: `sim-${i}` }), { forager: true })],
    ['a Legend bot that mostly forages', (i) => playYear(newGame({ seed: `sim-${i}`, perks: perksFor(legend, legendHeirlooms) }), { forager: true })],
  ];
  for (const [label, play] of runs) {
    const tiers: Record<string, number> = {};
    let tend = 0;
    let idle = 0;
    let busts = 0;
    let hybrids = 0;
    let trips = 0;
    let delivered = 0;
    let orderPoints = 0;
    let swaps = 0;
    let none = 0;
    const scores: number[] = [];
    for (let i = 0; i < n; i++) {
      const s = play(i);
      const sc = score(s);
      scores.push(sc.total);
      tiers[sc.tier?.name ?? 'None'] = (tiers[sc.tier?.name ?? 'None'] ?? 0) + 1;
      tend += s.stats.tendActions.reduce((a, b) => a + b, 0);
      idle += s.stats.idleActions.reduce((a, b) => a + b, 0);
      busts += s.stats.busts;
      trips += s.stats.trips;
      hybrids += s.hybridsMade.length;
      delivered += s.orders.filled.length;
      orderPoints += s.orderPoints;
      swaps += s.orderSwaps;
      if (!s.orders.filled.length) none += 1;
    }
    const mean = scores.reduce((a, b) => a + b, 0) / n;
    const tierLine = ['None', ...content.rules.tiers.map((t) => t.name)].filter((k) => tiers[k]).map((k) => `${k} ${((100 * tiers[k]) / n).toFixed(0)}%`);
    console.log(`${n} years with ${label}`);
    console.log(`  score: mean ${mean.toFixed(1)}, p10 ${pct(scores, 0.1)}, median ${pct(scores, 0.5)}, p90 ${pct(scores, 0.9)}`);
    console.log(`  tiers: ${tierLine.join(', ')}`);
    console.log(`  orders delivered per year: ${(delivered / n).toFixed(2)} for ${(orderPoints / n).toFixed(1)} points; none at all in ${((100 * none) / n).toFixed(0)}% of years; ${(swaps / n).toFixed(1)} swaps`);
    console.log(`  tend actions per month: ${(tend / n / 12).toFixed(2)} of 4; unused actions per year: ${(idle / n).toFixed(1)}`);
    console.log(`  bust rate: ${((100 * busts) / Math.max(trips, 1)).toFixed(0)}% of ${(trips / n).toFixed(1)} trips a year; hybrids per year: ${(hybrids / n).toFixed(2)}`);
  }
}
