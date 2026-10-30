# Review follow-up: the plan

Status: Phases 1–3 and 5 are done, and Phase 4 is done except item 5. Phase 3 was signed off 2026-10-30, with
Golden above target as a flag for Ben. Next: Phase 4 item 5, then Phase 6. Written 2026-10-30 from three
reviews: balance, speed and features. Section 0's decisions are settled (see Progress).

Progress (2026-10-30):

- **Phase 1:** done. Sim output is identical to the old code's, and the sim runs 2.8x faster.
- **Phase 2:** the Spade and truffle parts are done. The bot buys the Spade after other gear, keeps it as an heirloom,
  and digs with `spade: 'exit' | 'hunt'`; `npm run sim -- 20 truffle 30` reports the results.
- **Phase 2, Founder's Cache:** done. With `cache: true` the bot buys the Spade and digs under the Yew the first
  winter it has every mark; `npm run sim -- 30 cache 60` plays whole sagas (careful diving planner, passing on at
  Legend). Over 30 sagas:
  - Every mark is in by saga year 25 (p10 24, p90 27), early in generation 2.
  - The cellar is found in year 29 (p10 27, p90 31), always in generation 2, always at homestead level 8.
  - The 4-year gap is the Compass: the Hollow needs it, it unlocks at L8, and gear resets each generation. A
    player who keeps the Compass as an heirloom could dig as soon as the marks are in.
  - The cache is 15% of that year's score and 0.4% of the saga's renown. No balance concern.
- **Still open in Phase 2:** planning hybrids for the botanist. The bot's other commission changes were made
  with 3f (below).
- **Decisions (Ben, 2026-10-30):** D1–D4 as recommended. A repeat artifact scores half (rounded up), a skilled
  generation-2 Legend year targets 35–40 with Golden Chanterelle in at most 10% of years, the planner reaches
  level 10 around year 19, and the tonight preview and order progress are fine.
- **Phase 3: done, signed off 2026-10-30 (3h below).** Baseline sims from before any tuning are in the session scratchpad at
  `phase3/base/` (session 5cee1633). The `gen` sim now also has a planner row (plan, dive, careful), a top-tier
  column and an artifact points column, so D2 can be read off it directly.
  - **3a: code done, sim pending.** `artifactPoints()` in `engine.ts` halves a repeat artifact (rounded up), and
    `score()` uses it. There's a test in `underground.test.ts`. Only the gen sim's "full cabinet" row shows the
    effect (other rows start with an empty cabinet). **Sim (300/row, `phase3/3a-gen.txt`): target met.**
    Generation 4 with a full cabinet now earns 7.5–10 artifact points a year (planner 7.5, careful 8.8, careless
    10.1), against about 17 with an empty cabinet. Its median falls from 44 to 38–40 for the divers.
  - **The 3b starting point, from the same run:** the generation-2 planner has a median of 56 and p90 73, and
    reaches Golden Chanterelle in 27% of years. That confirms the review's 57 / 25%. D2's target is 35–40 and ≤10%.
    Generations 3 and 4 planners: 63 / 33% and 66 / 34%.
  - **3f, step 1: code done, sim pending.** Out of order, but it needs no numbers. `commissionFillable()` and
    `nextCommission()` in `engine.ts`; `takeCommission` deals the first commission that can still be filled
    (species in storage or coming into season by year end, zone still to open). Seasons are derived from
    species and zone data rather than a new `seasons` field in `commissions.json`. Phase 4 item 3 is done with
    it: the Market shows the next commission's ask and points before paying (`Market.tsx`). It still needs an
    engine test (e.g. "4 Morel" never dealt after spring) and a browser check. Cost 10 → 6 not yet applied.
  - **3b: applied, but D2's median target is out of reach. Needs Ben's call.** Below-ground values 5 → 3,
    6 → 4 and 7 → 4 in `species.json`, and `tierStep` 5 → 8. Tests pass. The gen sim (300 years a row) is in
    this session's scratchpad (session 2ad58133) at `phase3/3b-gen.txt`.
    - **Golden is close to target.** The planner reaches it in 13% of years in generation 2, 15% in
      generation 3 and 11% in generation 4 (was 27/33/34%). Almost all of this comes from `tierStep`, not the
      species values.
    - **The median barely moves.** The generation-2 planner goes from 56 to 52 (p90 73 → 68); generations 3 and 4
      go to 59 and 64. Divers are unchanged (31–44), so with bronze now at 37/45/53 they reach a tier only
      17–31% of the time.
    - **Why the median holds:** the generation-2 planner scores about 26 more than generation 1. Of that, 18 is
      orders and 6 is artifacts; coin points stay flat at 4–5. Two orders explain about 10 of the 18: "Any 2
      from below ground" (filled 0.97 a year, 6 points) and "4 different species" (0.40 → 0.96 a year, 7
      points). The rest comes from about 11 swaps a year (3.6 in generation 1), funded by 152 coins a year
      against 61. Of the coins, 55 come from selling below-ground finds and 39 from coin cards.
    - **The fallback doesn't work.** Two coin cards per layer deck (in memory) take generation 2 to median 51
      and Golden 12%, and it breaks four underground tests, because layer decks have a fixed card count. Reverted.
      Other levers, tested in memory with 100 years each: below-ground values at 2 give median 50; one coin card
      gives 48; `swapCost` at 4–5 gives 52–54, and it hurts generation 1 (27 → 24); values at 2 plus one coin
      card give 48. Nothing in the economy gets below about 48.
    - **To reach 35–40** a generation-2 year could add only about 10 over generation 1, and artifacts alone add 6.
      Note that a 35–40 median now sits at or below the new generation-2 bronze (37).
    - **Taken as accepted** (Ben said "continue"): 3b stays as is, the coin-card fallback stays out, and D2
      reads as a tier target, with Golden in about 10–15% of planner years. Confirm or reopen.
  - **3c: done.** `tierLift` at L3/L4/L5 is now 0/0/1. The sims are in `phase3/3c-campaign.txt` and
    `3c-plan.txt`.
    - **The planner's tier rate is level now.** From L2 to L6 it's 72, 68, 65, 70 and 69% (was 72, 62, 48, 66 and
      69%).
    - **Scores can't move.** `tierLift` only sets tier thresholds, so the score targets as written can't be met
      with this lever. The planner's L3 → L4 dip (19 → 16) and the baseline's 14 → 12–13 are unchanged. They
      come from play, not tiers. Pace is also unchanged, since renown doesn't depend on the tier reached.
  - **3d: done, target met.** Renown for L8/L9/L10 is now 270/340/420, and `progression.test.ts` follows. The
    planner starts L10 around year 19.6 on average (was 21.75), worked out from the years at each level in
    `3d-plan.txt`. Its L10 tier rate is 68% (was 70%).
  - **3e: done for story years, not daily.** The Spade costs 3. In story years, digging only on the way home, it
    breaks even at L6 (28.2 against 28.2) and gains 1.7 at L7 (`3e-truffle.txt`). Daily years (planner, 500
    seeds, compared without the Spade):

    | Spade | Mean score |
    | --- | --- |
    | None | 13.09 |
    | Cost 3, way home | 12.48 |
    | Cost 2, way home | 12.72 |
    | Cost 1, way home | 13.03 |
    | Cost 3, hunting | 12.88 (300 seeds, none 13.25) |

    The daily-year problem is yield, not price: 0.16 truffles a year digging on the way home. A skilled daily
    player should simply skip the Spade. If that's not OK, the lever is the dig, not the cost.
  - **3f, step 1: test added.** `commissions.test.ts` checks that the spring fair isn't dealt after spring unless
    the Morel is in storage, that the next fillable commission is dealt instead, and that taking one fails when
    none can be filled. The Market browser check is still open.
  - **3f, step 2: applied, target not measurable yet.** `commissionCost` is 6. The bot now asks
    `nextCommission()`, skips one the planner would give up on, and takes them through month 10 (`bot.ts`). It
    still takes only 0.1–0.3 a year from L7 (`3f-plan.txt`). A diagnostic over 200 L7 years shows why:
    - **Coins:** in 886 of about 1,130 checks the bot has spent its coins on swaps and gear earlier in the visit.
    - **The botanist:** it blocks another 144, because the engine always counts hybrids as fillable, and the
      planner never breeds.
    - **Before gear:** checking for a commission before buying gear gets the planner to 0.86 a year, but it then
      fills only 10 of 172 (6%). The bot doesn't plant or forage toward an open commission. Reverted.
    - **To measure 3f** the bot needs to plan for an open commission, as it does for orders. That is a Phase 2
      task of its own.
  - **3f, step 2, measured with commission planning: fill target met, take target not.** Planner, 20 × 30 years
    (`3f-plan-bot.txt`, session 9e40d189 scratchpad). From L7 it takes 0.2–0.4 commissions a year and delivers
    0.1–0.3, so 50–75% get filled. The target was at least 50% filled and about one a year taken.

    | Level | Median / tiers before | Median / tiers now | Commissions taken, delivered /yr |
    | --- | --- | --- | --- |
    | L7 | 25 / 73% | 25 / 74% | 0.2, 0.1 |
    | L8 | 29 / 76% | 31 / 73% | 0.4, 0.3 |
    | L9 | 29 / 71% | 30 / 70% | 0.3, 0.2 |
    | L10 | 35–36 / 69% | 39 / 73% | 0.4, 0.3 |

    - **Why one a year is out of reach:** the planner fills only about 0.25–0.3 commissions a year, however it
      chooses. Over 192 L7 years from real campaign journals, a stricter "can I fill it" check moved taken/filled
      from 0.80/39% to 0.60/48%, 0.42/62% and 0.34/71%. Filled per year barely moved (0.31, 0.29, 0.26, 0.24).
      The bot uses the 0.42/62% setting.
    - **Game issue for Ben, the pile order:** `takeCommission` deals the first commission that *can* still be
      filled. One the player can't realistically fill (the botanist without hybrid beds, the forester outside
      Porcini season, the spring fair without Morels in hand) sits on top and blocks every commission behind it
      until its season passes. At the 0.42 setting, most of the bot's blocked checks are on the apothecary,
      forester and fair. Options: deal the first two and let the player pick, or skip one the player passed
      on. Engine not changed.
    - **The botanist:** not planned for. The bot takes it only when hybrid beds on the farm will fruit three
      before the festival, and fills 10 of 10 when it does. Planning the parent pairs is still open in Phase 2.
    - **What the bot does now (`bot.ts`):**
      - `commissionInReach()`: storage, plus what the beds will fruit in season (shade-aware), plus one new bed;
        wild species at half a find per month in season; zone asks count floor finds only.
      - It takes a commission before buying gear, holds gear back for the year's first commission, and keeps no
        coin reserve. Gear owned at year end is up slightly (8.16 against 7.94 at L7).
      - Orders don't take species the open commission needs while it can still be filled (not on festival
        morning). The "6 different species" ask keeps one of each. `spawnPlan` adds beds for the commission.
    - **Bot fix found on the way:** Lion's Mane needs shade, and the planner put its substrate on the first empty
      square, so many beds never grew. The planner now plants shade-needing species beside a tree and spreads
      same-species beds apart. This affects every level. L1–L6 tier rates are now 48, 85, 76, 63, 84 and 75%
      (3c had 72, 68, 65, 70 and 69% for L2–L6).
  - **3f: accepted as is (Ben, 2026-10-30).** 50–75% of commissions taken get filled, and a planner taking
    0.2–0.4 a year from L7 is fine. The one-a-year target is dropped, and the pile order stays as it is.
  - **3h: signed off, with one flag: Golden is above target again.** Final sims, all on the committed code,
    in this session's scratchpad (session d62dd55a) as `sim-*.txt`. `progression.test.ts` now pins the tier
    table below, and the L10 renown in both tier tests is 420.
    - **Flag: the planner reaches Golden in 18–22% of generation 2–4 years**, against the accepted 10–15% (3b
      had 13/15/11%). Content is unchanged since 3b. The divers' rows match 3b exactly. Only the planner moved,
      because of the 3f bot work (Lion's Mane beside a tree, planning for commissions). The bot is now closer
      to a skilled player, so this is the truer number. The lever if Ben wants 10–15% back is `tierStep`
      (8 now) or Golden's `min`. Not changed here.

      | Generation (300 Legend years) | Planner median / p90 | Tier reached | Golden | 3b median / Golden |
      | --- | --- | --- | --- | --- |
      | 1 | 27 / 44 | 45% | 0% | 26 / 0% |
      | 2 | 56 / 73 | 97% | 19% | 52 / 13% |
      | 3 | 64 / 82 | 94% | 22% | 59 / 15% |
      | 4 | 68 / 89 | 92% | 18% | 64 / 11% |
      | 4, full cabinet | 63 / 85 | 80% | 13% | 59 / 6% |

      Divers stay at median 31–44 and reach a tier in 6–31% of years. Generation-4 artifact points with a full
      cabinet are 7.4–10.1 (3a's target of about 8 holds).
    - **Tiers by level** (generation 1; add 8 per generation): bronze is 15 at L1–L4, then 16, 21, 22, 24, 25
      and 29 at L5–L10. At L10, generation 2 has 37/47/57/67 for bronze, silver, gold and Golden. The planner's
      tier rate at L1–L10 is 48, 85, 76, 63, 84, 75, 74, 73, 70 and 73% (`sim-plan.txt`, 20 × 30 years).
      **Against 3c:** L4 dips to 63% (3c had 70%) and L1 is 48%. Both come from the bot fix in 3f, not from
      tiers. Median scores by level are 14, 19, 19, 17, 21, 28, 25, 31, 30 and 39, so the L3 → L4 and L6 → L7
      dips from play remain.
    - **Pace:** the planner starts L10 around year 19.0 on average (360 years below L10 over 20 campaigns), a
      bit sooner than 3d's 19.6. D3 met. The baseline bot reaches level 4.7 by year 10 and scores 12–14 a
      year throughout (`sim-campaign.txt`), as before.
    - **Spade, story years** (`sim-truffle.txt`; mean score against no Spade at the same level):

      | Level | None | Way home | Hunting |
      | --- | --- | --- | --- |
      | L6 | 29.8 | 30.2 (+0.4) | 30.7 (+0.9) |
      | L7 | 33.1 | 31.9 (−1.2) | 33.4 (+0.3) |
      | L8 | 28.5 | 32.3 (+3.8) | 30.9 (+2.4) |
      | L9 | 32.8 | 32.5 (−0.3) | 34.6 (+1.8) |
      | L10 | 38.5 | 37.5 (−1.0) | 40.8 (+2.3) |

      **Against 3e:** L7 on the way home went from +1.7 to −1.2. With 35–50 years in each cell, the swing
      is within noise (L8 shows +3.8 the other way). Read it as break-even on the way home, and a gain of 1–2
      for hunting from L8.
    - **Spade, daily years** (planner, 500 seeds, `sim-daily-spade.txt`): none 13.46, way home 12.65 (−0.81),
      hunting 12.95 (−0.51). 0.15 truffles a year on the way home. Same as 3e: a daily player should skip it.
    - **Commissions:** unchanged from 3f. Taken and delivered a year: 0.2/0.1 at L7, 0.4/0.3 at L8, 0.3/0.2
      at L9 and 0.4/0.3 at L10.
    - **Founder's Cache** (`sim-cache.txt`, 30 sagas of 60 years): every mark is in by saga year 22 (p10 20,
      p90 25), and the cellar is found in year 26 (p10 23, p90 28). It's always found in generation 2 at L8,
      and it's 15% of that year's score and 0.4% of the saga's renown. That's 3 years sooner than in Phase 2
      (25 and 29), from the same bot fix. Not a concern.
    - **Standard-kit years** (`sim-full.txt`, baseline bot): mean 11.0, median 11, and a tier in 21% of years.
      Daily-year tiers were left alone (3g).
  - **Next:** Phase 4 item 5 (show this year's tiers on the farm), which was waiting for these numbers. Then
    Phase 6. Ben's call on the Golden flag above comes first if it changes the tiers. The Market browser
    check for 3f step 1 is still open.

## Bottom line

Do the work in six phases. The order matters for the first three and not much after that.

1. **Speed up the engine first.** Every balance change needs sim runs. Copying only the touched deck instead of
   the whole state makes the sim about 3x faster: 4.6 min down to about 1.5.
2. **Then fix the bots** so the sim measures the Spade and commissions fairly.
3. **Then tune balance**, one lever at a time, re-running the sim after each. The underground coin flood comes
   first.
4. **Clarity in the UI.** Mostly show what the engine already tracks. Falls are the big one: the underground
   danger spec promised the cost would show before descending, and it doesn't.
5. **Phone rendering.** CSS and SVG only, so it can run alongside 1–4.
6. **New features**, ranked by value for effort, once the base is tuned.

Underground danger stays mild and daily years stay at level 1 throughout. Nothing here changes either.

## 0. Decisions for Ben

| # | Question | Recommendation |
|---|---|---|
| D1 | Should a layer's artifact score again every year, or only the first time it enters the cabinet? Today it scores every year: `s.artifacts` resets each year (`engine.ts:537`), the artifact is dealt again (`engine.ts:685`) and scored again (`engine.ts:334`). That's 12–15 points a year by generation 4. | **Score once per year, as now, but at half value after the first time.** It's a reason to dive without stacking a fixed bonus every year. "First time only" is the simpler alternative. |
| D2 | Target score for a skilled generation-2 Legend year | **35–40** for the planner, with Golden Chanterelle in at most 10% of years. Today it's 57, with Golden in 25%. |
| D3 | Target pace to level 10 | **About year 19** for the planner (now 22). The baseline still mostly doesn't reach it within 30 years. |
| D4 | The tonight preview and order progress make play easier, which nudges scores up. Acceptable? | **Yes.** The app keeping the books is a core pillar. Re-check the tiers afterwards. |

## Phase 1: a faster engine (M)

**Copy-on-write decks** in `dispatch` (`src/core/engine.ts:776`).

- **The change:** clone the state without its decks, and clone a zone's deck only when an action draws from it.
- **Why:** `structuredClone` of the whole state takes 88% of engine time, and decks are 66% of the state.
- **Measured** (fuzz workload):

  | Clone strategy | Time |
  | --- | --- |
  | Whole state (now) | 6.1 s |
  | Untouched decks shared | 1.7 s |

- **First:** check that no code changes card objects in place (search `engine.ts`, `underground.ts` and
  `growth.ts` for writes to card fields). Any that do must copy first.
- **Fallback:** if the audit turns up too much, a JSON round trip is a one-line change that gets to 3.6 s.
- **Tests:** the same seed must give the same result. Run `npm run sim` before and after and diff the output;
  it must match exactly. The fuzz test must still pass.
- **Optional:** store decks as indices into the content decks. Saves drop from about 25 KB to about 8 KB, and
  cloning gets cheaper again. Old saves need a migration.

**Expected:** `npm test` from 10.9 s to about 5 s, and `npm run sim` from 4.6 min to about 1.5. A card flip on a
phone also gets a few ms faster.

## Phase 2: fair bots (S)

These change `scripts/bot.ts` and `scripts/simulate.ts` only, so the sim stops understating features.

- **Spade:**
  - Add the Spade to `HEIRLOOM_PREFERENCE`, after the gear it should come behind.
  - Stop the bot rebuying the Spade ahead of other gear at levels 6–7.
- **Truffle hunting:** port the balance reviewer's "hunt" mode from `scratchpad/balance/bot2.ts`. In winter it goes
  to Mixed Woods or the Hollow and digs on the first Oak or Hazel it turns. Add a `truffle` sim report: truffles
  per winter, hit rate, and share of income.
- **Commissions:**
  - Let the bot take commissions through month 10, if what's needed is in season or in storage (now
    `s.round <= 9`, `bot.ts:241`).
  - Plan hybrids for `c-botanist`.
- **Founder's Cache:** add a sim mode that solves it on schedule. Then measure the year it's found and its points
  share, which is currently unmeasured.
- **Baseline:** record bot results before and after this phase, so the bot change shows up separately from the
  tuning in Phase 3.

## Phase 3: balance tuning (S each, run in order)

Change one thing, re-run the matching sim, then go to the next. Each step lists its lever, its target and the sim
to run. None of these values have been simulated yet: they're starting points.

### 3a. Artifact scoring (per D1)

- **Change:** `score().artifacts` (`engine.ts:334`) halves an artifact's points when it's already in the cabinet.
- **Sim:** generations 2–4.
- **Target:** artifact points per year in generation 4 drop from about 15 to about 8.

### 3b. The underground economy (the big one)

- **Below-ground species values** in `species.json`: 5 → 3, 6 → 4, 7 → 4.
  - Value 5: earthstar, charcoalburner, scarletelfcup, bitteroyster.
  - Value 6: bleedingtooth.
  - Value 7: ghostfungus, violetwebcap.
- **Tier step per generation:** `progression.json` `legacy.tierStep` from 5 to 8.
- **If still above target:** drop each layer deck from 3 coin cards to 2 (`underground.json`).
- **Sim:** the `gen` sim, planner and baseline, generations 1–4.
- **Target:** D2.
- **Watch:**
  - Swaps a year (now 13–14 below ground, against 3.5 on the surface).
  - The baseline diver's year-end coins (now 156–259).

### 3c. The flat stretch at levels 1–5

- **Change:** `tierLift` in `progression.json` from 2 to 0 at L3 and L4, and from 3 to 1 at L5.
- **Sim:** campaigns.
- **Target:**
  - The planner's average score rises at every level from L1 to L6, with no dips.
  - The baseline doesn't fall from L1 to L4 (now 14.4 → 12.9).

### 3d. Late pace

- **Change:** renown for L8, L9 and L10 in `progression.json` from 280/370/480 to 270/340/420.
- **Sim:** campaigns.
- **Target:** D3.

### 3e. The Spade

- **Change:** cost in `gear.json` from 5 to 3. Keep `rules.dig.chance` at 0.35.
- **Sim:** the new truffle report.
- **Target:** the Spade breaks even or better in daily years and at story L6–L7, with digging only on the way
  home.

### 3f. Commissions

1. **Deal only fillable commissions.** Add `seasons` to `commissions.json`. `commissionDeck` skips any
   commission that needs a species out of season for the rest of the year, unless the Dehydrator holds enough
   of it. This also fixes "4 Morel" turning up in winter.
2. **Then the cost:** `rules.commissionCost` from 10 to 6. Keep `commissionGrowth` at 2.

- **Sim:** generations 1–4.
- **Target:** at least 50% of commissions taken get filled, and a planner takes about one a year from L7.

### 3g. Leave alone

- **Underground danger:** careful and careless diving score the same, but busts and falls still happen.
- **The two harmless fall exploits:**
  - A fall in month 12 is free unless it's in the third layer (`engine.ts:1389`).
  - Falls after the first in a month cost nothing (`engine.ts:895`).
- **Daily-year tiers.**

### 3h. Sign-off

Run the full `npm run sim`. Update the tier tests in `progression.test.ts` and `features.test.ts` to the new
numbers, and note the final numbers in this doc.

## Phase 4: clarity (S each unless noted)

1. **Show what a fall costs.** This is the underground danger spec's own goal: "The cost is seen before
   descending".
   - **Before going down:** the Descend button shows the fall cost from `descendCost`, for example "A fall here:
     1 action next month" (`Forage.tsx`).
   - **On the bust:** the bust line uses `bustKeep(s)` instead of the hard-coded 2, and says what the fall costs.
   - **The night report:** add a line for `recovering` in `eventText` (`text.ts`, shown in `Night.tsx`).
   - **The farm:** an "out recovering" banner while `s.away` is set (`Game.tsx`).
   - **Sound:** a short low cue on a fall (`sound.ts`).
2. **Order progress on the farm.**
   - Each order card in the strip shows marks for what's already stored, what's in the basket, and what's
     growing.
   - A helper in `engine.ts` reuses the logic that picks which stored mushrooms an order would take, so the UI
     and the engine agree.
3. **Commission preview.** Show the next commission's ask and reward in the Market before paying (`Market.tsx`).
   Do it together with 3f.
4. **Truffle tells.**
   - In winter, a turned Oak or Hazel card shows a faint "truffle ground" mark.
   - A missed truffle dig gets its own message ("Nothing under this one"), separate from the cellar riddle's
     "The founder never dug here".
5. **Show this year's tiers.** Show the tier thresholds on the farm (tap the score), since they rise with level
   and generation.
6. **Artifacts.**
   - A piece already in the cabinet is tagged "already in the cabinet" when found, with the points it's worth
     under D1.
   - Set progress shows the moment a piece is found.
7. **Bring How to play up to date** (`Screens.tsx`): layers and falls, artifacts and sets, the Spade and
   truffles, commissions, and tiers rising with level and generation. Remove "Bronze 15+" or make it live.
8. **Small text fixes:**
   - "the The Hollow" in the Almanac's Compass unlock line and in the cabinet. Strip the article from zone names
     where a template adds "the".
   - The night report says both "Oyster is fruiting. Harvest it this month." and "Your apprentice picked 2
     Oyster". Skip the fruiting line for beds the apprentice harvested.

**Tests:** a text test for each new line (the `recovering` event, the bust keep count, the missed dig). An
engine test for the order-progress helper.

## Phase 5: phone rendering (can run alongside 1–4)

Ranked by how much a player would notice. Measure before and after with the pane visible: frame times on the
forage screen and the farm at 375 px with 4x CPU throttling, plus the night screen's element and animation
counts.

1. **The watercolour wash (S).** `.forage-wash`, `.zone-wash` and `.title-art::before` (`styles.css:1256`,
   `2115`, `2368`; the filter is at `art.tsx:17`).
   - **Fix:** bake the `#wash` texture into a small WebP, or use layered radial gradients.
   - **Stopgap:** give it its own layer (`will-change: transform`).
   - **Measured:** 48–186 ms to draw with the filter, against about 1 ms without.
2. **Glow pulses (S).** `glint` (3229), `door-glow` (3648), `glint-back` (3831), `breathe` (623) and the
   End-month glow (790) all animate `box-shadow`.
   - **Fix:** move each shadow to a `::after` with a fixed shadow, and animate its `opacity` and `transform`
     only.
3. **Drip Line drops (S).** 22 animated SVG circles over the whole farm (`Game.tsx:137`, `styles.css:1035`).
   - **Fix:** use HTML spans animating `transform` and `opacity`, or give the overlay its own layer.
   - **Also:** skip the drops in the small farm on the night screen.
4. **The night screen (S).**
   - **Fix:**
     - Hide the main farm while `busy` (`visibility: hidden`, or don't render it).
     - Replace the `filter: saturate() brightness()` on `.night .farm` (`styles.css:2180`) with night colours.
   - **Expected:** about half the elements and animations during every night (1,251 now).
5. **Re-render scope (M).**
   - **Fix:**
     - `memo(Farm)` (`Game.tsx:184`).
     - Stable store callbacks, so the store object isn't rebuilt on every render.
   - **Expected:** about half the render time of a card flip.
6. **Audio battery drain (S).** With music off and sound on, the `AudioContext` keeps running after the first
   tap (`sound.ts:118`).
   - **Fix:** suspend it after about 3 s of silence when music is off, and `await resume()` in `play()` (347).
7. **Loading (S, low impact).**
   - Preload the Alegreya and Sans-400 fonts.
   - Lazy-load Almanac, History, YearEnd and How to play: about 10 KB gzipped off the first load.
8. **Minor CSS.** Replace `transition: all` (1290) and the progress bar's `transition: width` (2694) with
   `transform`.

Saves (about 25 KB late game) and the bundle (80 KB gzipped JS) are fine. No work is needed there beyond the
optional deck indices in Phase 1.

## Phase 6: new features, ranked by value for effort

Each needs its own short spec before building, like `founders-cache-spec.md`. The ones that add points need a
`tierLift` re-check after.

| Rank | Feature | Effort | Fits because | Balance risk |
|---|---|---|---|---|
| 1 | **Tonight preview:** "Tap to rest" lists the beds that will dry out, blight, go overripe or cross tonight. Run a pure copy of `runGrowth` on a copy of the RNG state (`growth.ts`, `Game.tsx`). | M | The app keeps the books | Fewer mistakes. Keep where spreaders will land hidden |
| 2 | **Gear on the farm:** a tool wall on the shed with lantern, spade, waders, dehydrator rack and compass, and heirlooms marked (`art.tsx`, `Game.tsx`, `styles.css`) | S–M | Progress you can see; the next gear-visuals step | None |
| 3 | **Hybrid hints, then 1–2 new hybrids:** undiscovered pairs show in the journal as riddles (`hybrids.json`, `Progress.tsx`). New pairs come later (`growth.ts`). | S, then M | Deepens discovery; only 4 hybrids exist | +3 points per new hybrid |
| 4 | **Daily calendar and streak:** a month grid of daily years by tier, a streak and an average, and the streak on the share card (`History.tsx`, `share.ts`) | S–M | A reason to come back each day; daily years stay at level 1 | None |
| 5 | **Founder's afterword:** after the Cellar, the founder's journal becomes a lasting book. It holds hints toward third-layer sets and unfound hybrids, and gains one line of lore per generation (`artifacts.json` `cache`, `Progress.tsx`, `journal.ts`). | M | A one-time payoff becomes a thread through the saga | Information only, no perk |
| 6 | **Small polish bundle:** dishes for wild finds (`recipes.json`); Market in sections; the mastery list as a grid; achievements for the cellar, full sets and clearing a layer; generations as chapters on the Almanac; personal bests marked in Past festivals | S each | Each fixes a weak spot the features review named | Wild dishes add points; re-check tiers |
| 7 | **Late cultivated species** (already parked): King Oyster or Nameko at L8–9 with one hybrid partner (`species.json`, `progression.json`, `hybrids.json`, `orders.json`, `art.tsx`) | M | The farm gains nothing after L4; L8–10 are thin | Raises late scores; re-tune `tierLift` |
| 8 | **One unique rule per zone.** For example: the Riverbank closes for a month after Rain; the Meadow's fairy ring deals a mushroom card in its centre; the Old-growth hides hazard numbers until a neighbour is turned (`zones.json`, `flip`, `Forage.tsx`, `bot.ts`). | L | Zones today differ only by deck | More rules to learn; bots and tiers need re-tuning |
| 9 | **Hazard cue:** a soft sound as you get close to a hazard (`sound.ts`) | S | Adds tension without making it harsher | None |

## Order and parallel work

- **In sequence:** Phases 1 → 2 → 3. Each needs the one before: a fast sim, then honest bots, then tuning.
- **Alongside 1–3:**
  - Phase 5 (CSS and SVG only).
  - Phase 4 items 1, 2, 4, 6, 7 and 8.
- **Together:** Phase 4 item 3 (commission preview) with 3f. Item 5 (tiers on the farm) after Phase 3, so the
  numbers it shows are final.
- **Last:** Phase 6, one feature at a time, each with a spec and a tier re-check.

## Sources

The full review reports, with raw sim output, are in the session scratchpad (not in the repo):

- `balance/balance-review.md` (plus `harness.ts`, `bot2.ts`, `h-*.txt`, `sim-*.txt`)
- `speed/speed-review.md` (plus `clonebench.ts`, `saves.ts`, CPU profiles)
- `features/features-review.md`
