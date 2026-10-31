# Polish bundle: six small fixes to weak spots the features review named

Phase 6, rank 6 in `review-plan.md`. Approved by Ben 2026-10-30, with all three open choices as recommended.

## The answer

Six small changes, each fixing one weak spot from the features review. Only the first touches balance.

| # | Change | Fixes | Rules change |
|---|---|---|---|
| 1 | **Seven dishes for wild finds**, two of them worth festival points | 7 dishes, and only Chanterelle and Truffle are wild | Yes: data only, plus the planner bot. Tier re-check |
| 2 | **The Market in three tabs:** Orders, Sell, Buy | One long scroll at phone width | No |
| 3 | **The mastery list as a grid** of 34 tiles in three groups, tap for detail | A 34-row list in the Almanac | No |
| 4 | **Four new achievements:** the cellar, one full set, all six sets, clearing a layer | Nothing marks the saga's biggest feats | One new tracked fact (layers cleared) |
| 5 | **Generations as chapters** in Pass it on: what each generation did, not just its renown | The lineage view is a bare list | No |
| 6 | **Personal bests in Past festivals:** every year that set a new record is marked | Only the single top year is marked | No |

Build them in this order, one commit each, so each can be checked on its own.

## Why

- **Each is small and already scoped.** The features review rated these spots 3 out of 5 for fun or polish
  and named the fix for each. None needs new art beyond reusing the mushroom drawings.
- **Most of it shows what the game already tracks.** Items 3, 5 and 6 are pure display from the journal. Item 2
  is a layout change. Item 4 adds one fact to the year's state.
- **Only the dishes move scores**, so only they need the sim. Points dishes go to the rarest finds, so they
  turn a deep find into points late in the game, the way Truffle Shavings already does, without adding a new
  source of points every month.

## 1. Dishes for wild finds

Seven new dishes in `recipes.json`, using only the seven effects that exist today. Each one fills a season that
has no dish with that effect now, since storage spoils at a season's end without a dehydrator rack.

| Dish | Needs | Season | Effect | Fills |
|---|---|---|---|---|
| Morels in Butter | 1 Morel | Spring | A trip only busts on its third hazard | Spring has no trail food |
| Dryad's Saddle Stew | 2 Dryad's Saddle | Spring | Every bed counts as watered tonight | Spring has no watering dish |
| Porcini Pie | 1 Porcini | Fall | Every sale is worth 1 more coin | Fall has no market dish |
| Blewit Stew | 1 Blewit | Fall, winter | 1 more action this month | Winter has no action dish |
| Winter Broth | 1 Yellowfoot + 1 Wood Ear | Winter | Lookalikes fool you on one fewer number | Winter has no identify dish |
| Spring King Tart | 1 Spring King Bolete + 1 Morel | Spring | **3 festival points** | Points outside winter |
| Matsutake Rice | 1 Matsutake | Fall | **3 festival points** | Points outside winter |

That makes 14 dishes covering 10 of the 20 surface wild species. The underground species get no dishes: most
of them are inedible in life, and the disclaimer doesn't make that a good idea.

- **Points are priced like Truffle Shavings.** Truffle sells for 7 coins and cooks into 3 points. Matsutake
  is also worth 7. The tart takes a 6-coin and a 4-coin find for the same 3 points, because Morel is common in
  spring. Selling at 5 coins a point gets less than half that, so a points dish is the better use of a rare find
  once coins are capped, and the worse one while coins still count and an order wants it.
- **The cap stays one dish a month.** Points dishes need deep finds, which come about once a trip at most and
  only in season, so a year sees a few of them at most.
- **Village Cook (4 different dishes in a year) gets easier.** Spring alone can now offer three. That's fine:
  it was one of the harder early feats.
- **The Pantry:** with 14 dishes the list gets long, so it sorts the dishes you can cook now to the top, then
  the ones you've found the makings of, then the rest. The `?` art for unfound ingredients stays.
- **Rule text follows today's dishes.** For example, Porcini Pie: "The whole village wants a slice: every sale
  is worth 1 more coin this month." Matsutake Rice: "The judges hear about it: 3 festival points."

### Balance

- **The bot:** the planner bot cooks Truffle Shavings once coins stop scoring. It gets the same rule for every
  points dish, so the sim sees them. The baseline bot doesn't cook, so its numbers must not move.
- **Before and after:** `npm run sim -- 20 plan 30` and the gen sim. Compare median score and tier rate at
  every level, plus dishes cooked per year.
- **The bar:** if any level's tier rate rises more than about 5 points, raise `tierLift` there to bring it back.
  Golden at 18–22% of planner years stays the target. Expected: a rise of 1–3 points, mostly at L6 and up where
  coins are capped.
- **Daily years** use the standard kit, so they get the dishes too. The baseline bot shows no change, and the
  planner bot's level-1 numbers show the real effect there.

## 2. The Market in tabs

The Market sheet gets three tabs under the visit line. The visit line and the coin count stay above the tabs,
so you always see whether trading costs an action.

| Tab | Holds, in today's order |
|---|---|
| Orders | Festival orders, then the commission |
| Sell | Storage, then the shed's compost |
| Buy | Spawn, hands and supplies, then gear |

- **Which tab opens:** Orders when an order can be delivered right now, otherwise Sell. The sheet remembers
  the tab you last chose until the month ends.
- **A dot on Orders** when one is ready to deliver and you're on another tab, so a delivery is never missed.
- **Festival morning:** same tabs, opening on Orders.
- **Phone:** three equal tabs fit at 375 px with room to spare. Each tab scrolls on its own; the visit line
  doesn't.

## 3. The mastery grid

The 34 rows become a grid of small tiles, four across at 375 px, in three groups: Cultivated (7), Wild (20)
and Below ground (7). The mastery steps line above stays.

- **A tile:** the mushroom drawing (or the unknown one), its name in two lines at most, a thin progress bar,
  and the tile's edge in its mastery colour: none for New, then the colours the tags use today.
- **Tap a tile** and a detail line opens under its row: name, mastery level, and "14 of 20 identified for
  Master". Tap again, or another tile, to close or switch.
- **Each group's header** counts the masters in it: "Wild · 3 of 20 mastered".

## 4. New achievements

Four new entries in `achievements.json`, so 21 in all.

| Achievement | Feat | Check |
|---|---|---|
| Down in the Cellar | Find the Founder's Cellar | `cellar`: `s.cacheFound` |
| Whole Again | Complete an artifact set | `sets`, 1: sets complete across the cabinet and this year's finds |
| The Whole Cabinet | Complete all six artifact sets | `sets`, 6 |
| Nothing Left Below | Turn every card on an underground layer except its hazards, all in one trip | `clearLayer` |

- **Clearing a layer is new to track.** Each layer is one patch, so it's cleared when every card on it that
  isn't a hazard is turned, the heirloom and the way down included, before the trip busts or heads home. The
  engine records it like a cleared zone: `layersCleared` on the year's state, and on the journal.
- **Families who already did the first three** get them quietly when the journal loads: the cellar from
  `cacheFound`, the sets from the cabinet. No banner pops on the next year's first move. Layer clears were never
  tracked, so that one has to be earned.
- **Progress lines:** Whole Again and The Whole Cabinet show "Sets complete: 2 of 6" once the family has a
  piece. The cellar and the layer get none; they're feats, not counts.
- **No points.** Achievements never score, so no sim.

## 5. Generations as chapters

In Pass it on, the lineage list becomes one short chapter per generation, newest first. The current one is open
and the rest are folded to their first line.

```
Generation 2 · Legend of the Valley
6 story years · 1,240 renown · best festival 58, Gold
Opened the first layer: reached the Badger Setts and the Kiln Mouth.
Brought home the Drover's Penny.
First grew Snow Comb.
"Grandpa used to speak of badger setts under the meadow…"
```

- **The heading:** the generation and the title it reached when it passed the homestead on. The working
  generation reads "working the homestead now".
- **The facts**, each line only when it has something to say: story years and renown; the best festival;
  the layer it opened (generation n opens layer n−1) and which of those it reached; artifacts first brought
  home, sets completed and hybrids first grown, from the years it played; and "Found the Founder's Cellar" for
  the generation that did.
- **The last line** is the lore line that generation read, as Pass it on shows it today.
- **Story years only.** Daily years are level 1 and stand apart, so they don't count toward a chapter.
- **Old saves:** years recorded before generations were kept count as generation 1, as Past festivals already
  does. Years from before artifacts and hybrids were recorded just leave those lines out.
- **A bug this fixes:** the lineage records each generation's story years as the count of every story year so
  far, so generation 2 shows generation 1's years too. Chapters count each generation's own years from the
  year records instead.

## 6. Personal bests in Past festivals

Today only the single top-scoring year says "best". Instead, every year that beat all the earlier years of its
kind gets a small "record" mark, so the list shows how the family climbed, and the current record of each kind
says "best".

- **Two kinds, kept apart:** story years and daily years. Daily years are always level 1 with the standard kit,
  so a daily record is fair; a story record climbs with the homestead.
- **A tie isn't a record.** The first year to reach a score holds it, matching the field journal's best.
- **The festival screen** says "A new record" under the score when the year just finished set one.

## Open choices for Ben

1. **Points dishes: two, as above (recommended), or none.** None keeps item 1 out of balance entirely, but
   leaves Truffle as the only rare find worth cooking for points, which is half the weak spot.
2. **Market: tabs (recommended), or one scroll with jump links** at the top to each section. Jump links keep
   everything on one page but don't shorten it.
3. **Records: by kind, story and daily (recommended), or by generation.** Per generation reads well with the
   chapters, but it marks a record every first year of every generation, which says little.

Names in the tables are placeholders I'm happy with. Change freely.

## Implementation plan

- **Dishes:** seven entries in `recipes.json`; Pantry sort in `Pantry.tsx`; the bot's cook rule in
  `scripts/bot.ts` looks for any points dish. Tests in `features.test.ts`: each new dish needs and does what its
  rule says. Then the sim.
- **Market:** tab state and grouping in `Market.tsx`, styles in `styles.css`.
- **Mastery:** the grid in `Almanac` in `Progress.tsx`, styles in `styles.css`.
- **Achievements:** `AchievementCheck` gets `cellar`, `sets` and `clearLayer` (`types.ts`); `met` and
  `achievementProgress` in `achievements.ts`; `layersCleared` set on the flip that clears a layer
  (`engine.ts`, with the `??=` migration) and merged into the journal; the quiet grant on load in
  `journal.ts`. Tests: a cleared layer is recorded and a busted one isn't; the sets count includes this year's
  finds; the migration grants without a "fresh" banner.
- **Chapters:** a `generationChapters(j)` helper in `journal.ts` that works each chapter out from the year
  records, and the chapters in `Legacy` in `Progress.tsx`. Tests: per-generation year counts, first finds
  per generation, old years without a generation.
- **Records:** a `records(years)` helper in `journal.ts`, the marks in `History.tsx` and the line in
  `YearEnd.tsx`. Tests: ties, two kinds kept apart.
- **Then:** browser check at 375 × 812 for each screen; `docs/DESIGN.md` (dishes, achievements, Market);
  a Progress entry in `review-plan.md` with the sim numbers.
