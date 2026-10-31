# Late species: King Oyster and Crackle Crown

Phase 6, rank 7 in `review-plan.md`. Draft for Ben's approval; nothing built yet.

## The answer

One new cultivated species at L7, and one hybrid that comes with it:

| | Where it comes from | Unlocks at | What it does |
|---|---|---|---|
| **King Oyster** | Found in the Meadow; spawn at the market once identified | L7, Elder of the Wood | Straw, spring and fall, medium growth. **Heavy:** each harvest brings in 2. Value 2. |
| **Crackle Crown** | King Oyster × Shiitake | L7, with King Oyster | Straw or Log, spring and fall, slow. Heavy. Value 3. |

It brings one new trait, **heavy**. No new substrate: King Oyster grows on straw.

## Why

- **Straw has nothing worth growing late.** Today it holds only Oyster (value 1) and the two oyster hybrids. Logs
  carry every valuable crop. A heavy straw crop makes the cheapest substrate matter again in the late game.
- **L7 is the one late level with nothing for the farm.** L6 brings the Woodlot, L8 Snow Comb, L9 Claret Shelf
  and L10 the Old Orchard. L7 has commissions, a slot and the Waders, all off the farm. With King Oyster at L7,
  every level from 6 to 10 adds something to plan the farm around. (The review plan said L8–9; the two new
  hybrids took those since it was written.)
- **Heavy changes choices, not just numbers.** One bed can fill a "2 of" order in a single harvest. But the
  extra stock spoils at the season turn without a Dehydrator, and three King Oyster beds side by side still
  crowd. So it's a reason to plant one or two beds, not a whole field.
- **It sends late players back to the Meadow.** King Oyster grows on the roots of grassland plants, so the
  first zone gains a reason to visit once the deep woods are open.
- **Gating keeps the balance work small.** Daily years stay at L1 and years before L7 never see it. Only the
  L7–L10 tiers need re-checking.

## How it plays

### King Oyster

- **Rules:** substrate Straw; seasons spring and fall; medium growth; trait `heavy`; value 2, so spawn costs 4.
- **Rule text:** "Heavy. Each harvest brings in two. Grows on straw in spring and fall."
- **Finding it:** from L7, two King Oyster cards are shuffled into the Meadow deck. Identify one and the market
  sells its spawn for the rest of the year, like every cultivated species. Once it's in the field journal, later
  generations get the spawn as soon as they reach L7, not before.
- **In the forest:** group "Stout pale stem", lookalike Livid Pinkgill on a 1. Mastery works as for any species,
  so the Cultivated group in the mastery grid grows to 8.
- **Latin and blurb:** *Pleurotus eryngii*. "A fat white stem under a small tan cap, from the roots of sea holly."
- **Art:** the existing `bolete` shape (fat stem, flat cap) in tan and cream. No new drawing code.

### Crackle Crown (King Oyster × Shiitake)

- **Crossing:** straw beside a log in spring or fall. Both parents share those seasons and the two substrates
  are the cheapest to lay, so it's the easiest late cross to set up.
- **Rules:** substrates Straw or Log; seasons spring and fall; slow; trait `heavy`; value 3.
- **Rule text:** "Heavy and slow. Each harvest brings in two. Grows on straw or logs in spring and fall."
- **Riddle:** "A fat white stem under a cracked brown crown. Straw beside a log, in the spring."
- **Art:** `bolete` again, with a Shiitake-brown cap.
- **Gate:** a `hybrid` unlock at L7 too, so its journal page reads "Crosses from level 7, Elder of the Wood"
  instead of teasing a cross nobody can make yet.

Per month in season, Crackle Crown earns about what Lacquer Cap does (6 every 3 months against 6 every 3), but
only in two seasons, so Lacquer Cap stays the farm's best crop.

### The heavy rule

- Every harvest of a heavy bed puts 2 in storage instead of 1: the Harvest action, the apprentice's
  auto-harvest at L9, and the festival's last harvest.
- It doesn't change growth, spreading or the night, so the tonight preview is untouched.
- The harvest message counts both: "Harvested 2 King Oyster."

### Gating

- **A new unlock type,** `{ "type": "species", "id": "kingoyster" }`, on L7. `perksFor` collects it into a new
  `Perks.species`.
- **Before L7:** no King Oyster cards in the Meadow, no spawn even if the journal has it, no order for it. The
  Meadow's "what grows here" line leaves it out. The Almanac's level list reads "A new species comes up in the
  Meadow".
- **After passing on,** the level resets with the generation, and so does the unlock.

### What else changes

- **One new order,** "2 King Oyster", 5 points, dealt only from L7. A single heavy harvest fills it.
- **Points:** planting it scores `plantedPoints` (1) like any species; making Crackle Crown scores
  `hybridPoints` (3) the first time each year. "Any 2 hybrid mushrooms", "4 different species" and the
  botanist's commission count them.
- **Bot:** knows a heavy bed yields 2 when it plans spawn for an order.

## Open choices for Ben

1. **Which species.** Recommended: King Oyster, because it gives straw a late crop. Nameko was the other
   candidate, but it's a log mushroom of fall and winter, where Enoki and Snow Comb already sit.
2. **Which level.** Recommended: L7, so every level from 6 to 10 has a farm unlock. The alternative is L8 as the
   review plan first said, which stacks it with the Hollow and Snow Comb.
3. **The heavy trait.** Recommended: yes, as above. The alternative is no trait (a plain value-2 straw crop),
   which is simpler but gives little reason to grow it over a Shiitake log.
4. **How you get it.** Recommended: found in the Meadow, then spawn. The alternative is spawn at the market the
   moment you reach L7 with no find needed, which is simpler but leaves its mastery tile unreachable.
5. **Names.** Crackle Crown is a placeholder. Change freely.

## Balance

- **Before and after:** `npm run sim -- 20 plan 30` and the gen sim. Compare L7–L10 median score, tier rates,
  and King Oyster beds and Crackle Crowns per year.
- **The bar:** if L7–L10 tier rates rise more than about 5 points, raise `tierLift` there to bring them back.
  Expected: a rise of a few points (the order, a planted point, a hybrid now and then), so likely +1 to +3.
- **Earlier levels and daily years** must match the old sim output exactly. That proves the gate holds, including
  the Meadow deck, which only grows at L7.

## Implementation plan

- **Data:** King Oyster in `species.json` (after Enoki), Crackle Crown in `hybrids.json`, the two L7 unlocks in
  `progression.json`, a gated deck entry in `zones.json` (`"unlock": "kingoyster"`), the order in `orders.json`
  (`"requires": "kingoyster"`).
- **Engine:**
  - `Unlock` gets `{ type: 'species'; id: string }`; `Perks.species`. Saves without it treat King Oyster as locked.
  - `buildDeck` takes the perks and skips gated entries, everywhere a deck is dealt or its printed size checked.
  - `spawnStock` leaves out gated species not in `perks.species`.
  - An order's `requires` is met by gear in the shop or a species in `perks.species`.
  - `SpeciesTraits.heavy`; harvest, auto-harvest and the finale harvest add 2.
- **Bot:** `bedYield` doubles for heavy species.
- **UI:** `unlockText` for the new unlock (`Progress.tsx`); the Meadow's finds line (`Forage.tsx`) leaves out
  locked species; harvest text counts the 2.
- **Tests:**
  - No King Oyster cards, spawn or order below L7; all three at L7 (engine).
  - A heavy bed harvests 2, by hand and by auto-harvest.
  - King Oyster × Shiitake crosses at L7.
  - A level 1 year deals the same Meadow deck as before (same seed, same order).
  - `tonight.test.ts` still matches every night.
- **Browser check at 375 px:** the Meadow at L7 with a King Oyster find, spawn in the Buy tab, a 2-count
  harvest, and the Crackle Crown journal page.
- Then `docs/DESIGN.md`, a Progress entry in `review-plan.md`, and the sim numbers recorded there.
