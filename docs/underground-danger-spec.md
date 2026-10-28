# Underground danger: spec

Status: draft for Ben. Written 2026-10-28. Open questions at the end.

## Goal

Make a fall below ground cost time at the homestead, more the deeper it happens: 1 action next month in a
first layer, 2 in a second, and the whole next month in a third, while the beds grow untended. Rewards below
rise to match, and the Mushroom Stones soften the fall by one step. Nothing runs on the real-world clock.

Three things drive the shape:

- **Today a bust below ground costs exactly what a bust in the meadow does.** Nothing carries past the trip, so
  depth changes the odds of a bust but not its price.
- **Time at home is the currency the game already uses for setbacks.** The Mold Bloom already takes an action
  off next month; this reuses that hook, so it reads as part of the same world.
- **It stays avoidable and fair.** The bust is the second hazard, so a player who heads home after the first
  never pays. The cost is seen before descending, has no dice in it, and can't reach a daily year.

## What exists today

### What a bust is

- A trip busts on its second counted hazard (`rules.bustAt` 2; `bustAt()` in `src/core/engine.ts` adds 1 for
  Chanterelle Toast). The Mushroom Knife ignores the first hazard of each trip.
- Hazards met on the surface still count below (`trip.hazards` carries through `descend`).
- On the bust (`flip`, the `hazard` branch in `dispatch`): `trip.status = 'busted'`, `stats.busts += 1`,
  `trip.lost = trip.picked.slice(bustKeep(s))`, the lost finds leave the basket, `bankRelics` brings home any
  artifact among the kept finds, and `restockDeck` shuffles every deck the trip walked.
- `bustKeep()` is `rules.bustKeep` 2, plus 1 with the Mushroom Stones set (`setBonus(sets, 'keep')`).

### What an underground bust costs now

Exactly this, at every depth:

1. Every find after the first two (three with the Mushroom Stones), including the layer's artifact if it was
   turned late. A lost artifact stays below and is dealt again on the next trip that year (`layerRelic`).
2. The rest of that trip.

Nothing else. The trip's one action was spent at `forage`; `deeper` and `descend` cost none. The rest of the
month goes on as normal, and nothing reaches next month. A bust in a layer 3 is priced the same as one in the
meadow's first patch.

### The layers

- `layersOpen(generation, zone)` in `src/core/underground.ts`: `generation − 1`, at most 3. Generation 1 reaches none.
- Each layer is one 3×3 patch dealt from its own 12-card deck (`src/data/underground.json`), with the layer's
  artifact dealt in from outside the deck and, when a deeper layer is open, the way down (`wayDown`). There's no
  `deeper` in a layer, only `descend` again or home.
- Per layer, across the six zones:

| Layer | Hazards in 12 | Coin cards | Artifact points | Artifact sets |
|---|---|---|---|---|
| 1 | 4 (Burn Scar 5) | 3 × 3 coins (Hollow 4) | 2 | Purse, Lantern |
| 2 | 5 (Burn Scar 6) | 3 × 4 coins (Hollow 5) | 3 | Ribbons, Maps |
| 3 | 6 (Burn Scar 7) | 3 × 5 coins (Hollow 6; Burn Scar 2 × 6) | 4 | Stones, Homestead |

The Mushroom Stones' three pieces all lie in third layers (Meadow, Mixed Woods, Old-growth).

### Time at the homestead

- `actionsPerMonth()` is `rules.actionsPerRound` 4 + `perks.bonusActions` (levels) + challenge effects
  (Short-handed −1).
- At `endMonth`: `s.actionsLeft = actionsPerMonth(s) − s.moldPenalty`. `moldPenalty` is set by `runGrowth` in
  `src/core/growth.ts` (3 or more blighted beds: `rules.moldBloomPenalty` 1). This is the only setback today that
  reaches into next month, and the hook this spec reuses.
- Ways to buy actions back: `hireHand` (5 coins, +2 a hire after, once a month) and Reishi Tea (+1 action).
- Beds left alone: a bed not watered (by hand, rain, Drip Line or Puffball Supper) gets a dry mark, and 2 marks
  blight it (1 for thirsty species). Fruit not harvested goes overripe. `perks.autoHarvest` picks fruit at first light.
- Storage spoils when a season turns (after months 3, 6 and 9) unless you own the Dehydrator.
- Festival morning (`s.finale`) has 0 actions, one last harvest and one market visit.

### Orders

Orders have no deadlines. An order stays on the board until it's delivered or swapped; the festival is the only
deadline. Each market visit costs an action and allows one free delivery (more cost coins, `deliveryCost`).

### Daily years

A daily year is built from `standardPerks()` (`src/ui/store.ts`), which is generation 1: no layers, no layer decks
(tested in `tests/underground.test.ts`, "deals layer decks only for the open layers, and none for a daily year").
A daily player can never be below ground.

### Who is below ground

Only homesteads in generation 2 or later, which means a Legend has passed it on. `passItOn` resets renown and gear,
so a new generation's first years have a thin kit and few bonus actions. Legend challenges come back once that
generation reaches Legend again.

### What the bot sees

`scripts/bot.ts` with `dive` goes underground on every other trip to a zone with layers open, turns cards until it
finds each way down, and at the bottom uses its surface rule: head home after a hazard once it has 3 finds. The
baseline bot (no `dive`) only descends from a clean trip. `npm run sim -- 300 gen` today (2026-10-28):

| Generation | Bronze | Median | p90 | Tier reached | Artifacts/yr | Descents/yr | Bust rate |
|---|---|---|---|---|---|---|---|
| 1 | 15 | 18 | 31 | 74% | 0.0 | 0.0 | 1% |
| 2 | 20 | 32 | 43 | 96% | 2.6 | 12.6 | 2% |
| 3 | 25 | 38 | 51 | 98% | 5.0 | 22.3 | 6% |
| 4 | 30 | 46 | 58 | 97% | 6.9 | 30.7 | 16% |
| 4, full cabinet | 30 | 47 | 60 | 98% | 6.9 | 30.6 | 17% |

The bust rate there is over all trips. Underground busts alone are in "Balance" below.

## The rule

### What a fall costs

A bust below ground sends you home hurt. You're **out recovering** next month:

| Bust in | Next month at the homestead |
|---|---|
| The surface | Nothing, as today |
| Layer 1 | 1 action fewer |
| Layer 2 | 2 actions fewer |
| Layer 3 | Away the whole month: no actions at all. The beds still grow, but nothing is tended, harvested or delivered |

- **The rest of the bust month is untouched.** You limp home and carry on; the cost lands when the month turns.
- **It stacks with the Mold Bloom and with Short-handed,** and the month never drops below 0 actions.
- **Two falls in one month don't add up.** Only the deepest counts: you're recovering from your worst fall,
  not adding them up. (The simulator added them, which only makes its numbers a little harsher.)
- **No dice.** The cost comes straight from the layer, so it never touches `s.rng`. A year with no underground
  bust plays out exactly as it does today from the same seed.
- **Buying time back works for layers 1 and 2.** Hiring a hand and Reishi Tea still add actions, so coins or a
  stored Reishi can make up a lost action. That keeps a remedy in reach.

### A month away (layer 3)

- At `endMonth`, the month you're away starts with `actionsLeft = 0` and `s.away = true`.
- Every homestead move fails with "You're out recovering this month.", including the free ones (shed chores,
  cooking, hiring, the market, the tent). Hiring and cooking have to be blocked by name, because they don't
  spend an action and would otherwise undo the penalty.
- What still works: `resolveCross` (crosses are offered at night and block `endMonth`), `dismissNight` and
  `endMonth` itself, shown as **Come home**.
- The night still runs in full: growth, rain, the Drip Line, auto-harvest at first light, spoilage, compost. Unwatered beds take dry marks and fruit goes overripe. That
  neglect is the real cost.
- `s.away` clears at the next `endMonth`.

### The Mushroom Stones soften it

With the Mushroom Stones set complete, every fall costs one step less: layer 1 nothing, layer 2 1 action,
layer 3 2 actions (not a month away). This is on top of the set's current perk (a bust keeps one more find).

Why the Stones and not mastery: mastery is per species (Familiar, Expert, Master, from `stats.identified`), so
there's no overall rank to soften a fall with, and tying it to "Master of every underground species" would be
hard to explain. The Stones already soften busts, and all three pieces lie in third layers, so a family that has
survived layer 3 three times has earned the softer landing. No new content is needed.

### Rewards rise to match

A small raise, weighted to the bottom, because the penalty is mild in the numbers (see Balance):

- Coin cards in layers 2 and 3 pay 1 more (layer 2: 5, Hollow 6; layer 3: 6, Hollow 7, Burn Scar 7).
- Third-layer artifacts score 5 points instead of 4 (the Stones and the First Homestead).
- Layer 1 stays as it is: its fall costs only 1 action.

Coins count for points only up to `rules.maxCoinPoints` 10, so the coin raise matters most for buying gear and
hands early in a generation, which is also when the penalty hurts most.

### Showing it

The engine work comes first. The screens are for after the hazard-animation and sound sessions merge, since
they're in `src/ui` now.

- **Before going down.** The Descend button (and the way-down card's hint) names the stakes for the layer you're
  about to enter: "A fall down here costs 2 actions next month." For a layer 3: "A fall down here costs the whole
  next month at home." With the Stones, the softer cost. Players should never meet the cost for the first time
  after the fact.
- **On the bust.** The bust message adds: "You limp home. You'll be out recovering next month (2 actions fewer)."
- **Next month.** The night report gets a `recovering` event ("Still sore from the Old Well: 2 actions fewer this
  month."). For a month away, the farm shows the "out recovering" state: the farm dimmed, a note pinned over it
  ("Out recovering from the Spring Below. The beds will have to look after themselves."), every action button
  replaced by **Come home**.
- **Festival screen.** The playtest log adds underground busts and months away beside busts.

## Edge cases

### The last month or two of the year

- **A fall in month 11** costs month 12 as normal. A layer 3 fall in month 11 means month 12 away and then
  festival morning as usual. It's harsh, but it's the same rule, and the warning before descending says so.
- **A fall in month 12** has no next month: festival morning comes next, with no actions to lose.
  - Layers 1 and 2: forgiven. There's nothing to take, and taking the market visit would cost more than the
    rule says.
  - Layer 3 (2 actions with the Stones: also forgiven): you miss the **last harvest**. `s.finale.harvested`
    starts true and the festival screen says "You made it to the festival, but not to the beds." The market
    visit stays, so storage can still be sold and an order delivered. This shuts the month-12 loophole for the
    deepest layer without making anyone miss the festival.
- Auto-harvest still picks at first light before festival morning, so a homestead with that perk loses less.
  That's fine.

### Order deadlines

There are none: orders stay on the board until delivered or swapped, and the festival is the only deadline. So
the cost to orders is indirect: fewer market visits, and a month away can't deliver at all.

The real deadline is the season turn. A month away in month 3, 6 or 9 means storage spoils with no chance to sell
it, unless you own the Dehydrator. The rule stays as it is (no protection), but the layer 3 warning adds "Your
stores will spoil at the season's turn" when the next month ends a season and you don't own a Dehydrator.

### Daily years

- No change, and no new risk: a daily year is generation 1, so `trip.layer` is never above 0 and the recovery
  code never runs.
- If dailies ever open layers, the rule stays fair because it has no dice and is the same for everyone on the
  same seed. Busting is the player's own choice of when to stop.
- A test pins this: a daily year can't descend, and its state never gets `recovery` or `away`.

### Legend challenges

- **Short-handed** (3 actions a month): layer 1 leaves 2, layer 2 leaves 1, layer 3 is still a month away. With a
  Mold Bloom on top, a layer 2 fall can leave 0 actions. That's allowed (floor at 0) and not a month away, so free
  moves still work.
- **Lean Year**: no starting coins and no heirlooms, so hiring a hand to make up the time is harder. Intended:
  it's a challenge.
- **Thin Basket**: no interaction.
- Challenge renown bonuses are unchanged. The underground isn't a challenge, so it doesn't earn extra renown.

### Other interactions

- **Chanterelle Toast** (bust on the third hazard) and the **Mushroom Knife** delay the bust, so they now matter
  more below ground. No change needed.
- **A new generation's first year.** `passItOn` resets gear and levels, so a new gen 2 homestead has 4 actions
  and few coins. A layer 1 fall is 25% of its next month. The simulator only plays Legend homesteads with every
  gear owned, so it understates this. See the open questions.
- **Achievements.** Sure-Footed (10+ trips, no bust) is unchanged. A "Back on your feet" feat for a festival
  tier after a month away would be a nice later addition; out of scope here.
- **Old saves.** `migrateState` sets `recovery ??= null` and `away ??= false`. A save with a busted trip open from
  before the change doesn't owe anything.

## Engine changes

All in `src/core` and `src/data`; no UI.

- `src/data/rules.json`: `"recovery": { "actions": [1, 2], "awayFrom": 3 }`. The cost for layer `d` is
  `actions[d − 1]` while `d < awayFrom`, and a month away from `awayFrom` on.
- `src/core/types.ts`:
  - `GameState.recovery: { zone: string; layer: number } | null`, the fall owed to next month.
  - `GameState.away: boolean`, true for the month you're out recovering.
  - `stats.deepBusts: number[]` (busts by layer, index 1 to 3) and `stats.monthsAway: number`.
  - `NightEvent` adds `{ type: 'recovering'; zone: string; layer: number; actions: number | 'month' }`.
- `src/core/underground.ts`: `recoveryCost(layer, sets, c): number | 'month'`, applying the Stones' one-step
  softening, and nothing for layer 0.
- `src/core/engine.ts`:
  - On a bust with `trip.layer > 0`: set `s.recovery` to the deeper of the one owed and this one, and count
    `stats.deepBusts[layer]`.
  - `endMonth`, not final: after `actionsLeft = actionsPerMonth − moldPenalty`, apply the cost (subtract, floor 0,
    or `away = true` and 0), push the `recovering` event, clear `recovery`. Clear last month's `away` first.
  - `endMonth`, final: a month away owed sets `finale.harvested = true`; anything less is dropped.
  - A `guardAway` in every homestead action (forage, identify, plant, discard, compostBasket, placeSubstrate,
    water, clearBlight, compostSquare, harvest, the market moves, hireHand, buySubstrate, buySpawn, saveSpawn,
    cook, buyGear, placeTent, moveTent).
  - Export `recoveryCost` and a `descendCost(s)` query for the next layer's stakes, so the UI can warn before
    descending.
- `scripts/bot.ts`: `playYear` gets a `careful` option: below ground, head home after the first counted hazard,
  and don't descend with one already counted. `dive` keeps its current, careless behavior as the worst case.
- `scripts/simulate.ts`: the `gen` mode adds columns for underground busts a year, actions lost and months away,
  and plays both `dive` and `dive` + `careful`.
- `docs/DESIGN.md`: the underground section gets a "Falls" paragraph and the new sim table.

## Balance

The penalty is mild for a careless diver and costs nothing to a careful one; layer 3's month away almost never
fires. The figures come from a scratch copy of the bot with the penalty applied at `endMonth`: 200 Legend years a
generation, every gear owned, `dive` on, the same seeds as `npm run sim -- 300 gen`. No repo code was changed.

**How often the bot busts below ground today** (the baseline bot with `dive`):

| Generation | Underground trips/yr | Underground busts/yr | Of those trips | By layer 1 / 2 / 3 | In months 11–12 |
|---|---|---|---|---|---|
| 2 | 12.6 | 0.07 | 1% | 0.07 / 0 / 0 | 0.01 |
| 3 | 11.6 | 0.95 | 8% | 0.92 / 0.04 / 0 | 0.16 |
| 4 | 11.7 | 3.42 | 29% | 0.92 / 2.49 / 0.01 | 0.63 |

Generation 4's falls are mostly in layer 2, because the bot rarely finds layer 2's way down before busting. It
reached a layer 3 and busted there about once in 100 years.

**What the penalty does to the score:**

| Generation 4 | Median | p90 | Tier reached | Artifacts/yr | Actions lost/yr | Months away/yr |
|---|---|---|---|---|---|---|
| Today | 46 | 59 | 98% | 6.8 | 0 | 0 |
| Penalty, bot unchanged | 44 | 57 | 97% | 6.4 | 4.9 | 0.01 |
| Penalty, careful bot | 44 | 57 | 94% | 6.3 | 0 | 0 |
| Penalty + richer rewards, bot unchanged | 45 | 58 | 97% | 6.4 | 4.9 | 0.02 |
| Penalty + richer rewards, careful bot | 45 | 58 | 95% | 6.4 | 0 | 0 |

- **Generations 2 and 3: no change.** The median stayed at 32 and 38 to 39; generation 3 loses under 1 action a year.
- **Generation 4: about 2 points off the median, about 5 actions a year** (of roughly 50). Bronze or better barely moves.
- **Heading home after the first hazard below ground is exactly as good, and never pays.** Because the bust is the
  second hazard, the careful bot never busted underground in 600 years. It scores the same median by leaving
  finds behind instead. That is the choice the rule is meant to create.
- **The richer rewards win back about 1 point**, about half the loss. They can't do more, because layer 3 is so
  rarely reached and coin points are capped.
- **The headroom is large.** Generation 4's median is 46 against a Bronze of 30, so the underground can afford to
  cost more than this.

**What the simulator understates:**

- It plays Legend homesteads with every gear owned. A new generation's first years have 4 actions, little gear
  and few coins, so a lost action costs more of the month.
- The bot never plans around a season turn or an order, so it doesn't feel a month away the way a player would.
- A player who goes for the Stones goes to layer 3 on purpose, so months away will be far more common for
  players than for the bot.

## Tests

In `tests/underground.test.ts`, under a new `describe('falls below ground')`:

- A surface bust leaves next month's actions as today.
- A layer 1 bust takes 1 action off next month, a layer 2 bust 2. The bust month's remaining actions are untouched.
- A layer 3 bust leaves next month away: 0 actions, `away` true, and forage, harvest, water, sell, fillOrder,
  hireHand, cook and placeSubstrate all fail with the recovering message. `resolveCross`, `dismissNight` and
  `endMonth` work.
- During a month away the night still runs: an unwatered bed takes a dry mark, ripe fruit goes overripe, rain
  and the Drip Line still water, auto-harvest still picks.
- `away` clears after one month, and the month after has full actions.
- The cost stacks with the Mold Bloom and Short-handed and never goes below 0.
- Two busts in one month: the deepest counts, not the sum.
- With the Mushroom Stones: layer 1 costs nothing, layer 2 1 action, layer 3 2 actions and not a month away.
- Hiring a hand and Reishi Tea still add actions in a short month (layers 1 and 2).
- Month 12: a layer 1 or 2 bust changes nothing on festival morning. A layer 3 bust starts festival morning with
  `harvested` true and the market visit still open.
- A season-turn month away still spoils storage without the Dehydrator.
- The bust adds to `stats.deepBusts` at its layer, and a month away to `stats.monthsAway`.
- The `recovering` night event names the zone, layer and cost.
- No dice: from the same seed, two years that differ only by an underground bust have the same `rng` state
  after the bust. A first-generation year is unchanged from the same seed (the existing test still passes).
- A daily year never gets `recovery` or `away`.
- `descendCost` gives the next layer's cost, softened by the Stones, and nothing on a trip that can't descend.
- An old save without `recovery` or `away` loads through `migrateState`.
- Reward changes, if any: the data test for rising hazards still holds, and artifact points still rise with depth.

## Out of scope

- Anything on the real-world clock.
- New hazard types or injuries that last more than a month.
- UI work beyond describing it above (the screens are for later).
- Changing surface busts.

## Done when

- A fall below ground costs next month's time as in the table, softened by the Stones, and festival morning
  follows the month-12 rule.
- Rewards are raised as decided below, and the simulator reports underground busts and time lost.
- `npm test` and `npm run build` pass, and `npm run sim -- 300 gen` has been rerun into `docs/DESIGN.md`.

## Open questions for Ben

1. ~~**Is this enough danger?**~~ **Decided (Ben, 2026-10-28): yes.** The danger is mostly flavor, the
   illusion of danger. A mild cost (about 2 points at generation 4) is the point, so the warning before going
   down and the "out recovering" farm matter more than the numbers. Don't make it bite harder.
2. ~~**Raise the rewards at all?**~~ **Decided (Ben, 2026-10-28): no raise.** The underground already scores well above the tiers (generation 4 median 46
   against a Bronze of 30). The small raise above wins back half the loss. Skipping it makes the danger a real
   trade-off instead of a wash.
3. **The Mushroom Stones as the softener.** Doubling up the Stones' perk needs no new content. The other option
   is new gear (a rope, say) bought each generation, which would also help the thin-kit first years. Mastery
   doesn't fit, because it's per species.
4. **A layer 3 fall in month 12.** The proposal costs the last harvest and keeps the market visit. The
   alternative is forgiving it outright ("nobody misses the festival"), which leaves a free dive in the last month.
5. **Season turns.** Should a month away at the end of a season protect storage from spoiling, or is spoilage
   part of the price (the proposal, with a warning)?
6. **How strict is a month away?** The proposal blocks the free shed chores too, to keep the fiction clean.
   Allowing them (placing tiles, saving spawn) would make the month feel less like a lockout.
7. **New generations.** Should the cost be lighter in a generation's first year, when the kit is thin, or is
   that what the warning before descending is for?
