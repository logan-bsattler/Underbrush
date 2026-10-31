# New hybrids: Snow Comb and Claret Shelf

Phase 6, rank 3 in `review-plan.md`, second half. Approved by Ben 2026-10-30 with all three open choices as
recommended (gate at L8/L9, the feeder trait, these names). Built 2026-10-30; results in `review-plan.md`. The first half, hybrid riddles,
shipped in `hybrid-hints-spec.md`.

## The answer

Two new hybrids, each unlocked by a homestead level that has little in it today:

| Hybrid | Parents | Unlocks at | What it does |
|---|---|---|---|
| **Snow Comb** | Lion's Mane × Enoki | L8, Pathfinder | Grows through fall and winter and ignores Cold Snap, but only beside a Tree. Value 4. |
| **Claret Shelf** | Reishi × Wine Cap | L9, Lorekeeper | Slow. Each time it fruits, every adjacent bed still at Spawn jumps to Colonized. Value 5. |

Snow Comb uses two traits the game already has. Claret Shelf brings one new trait, **feeder**. Both get a
riddle on their journal page like the other four.

## Why

- **Only four hybrids exist.** Of the 21 pairs of cultivated species, four cross today, and six of the seven
  species have only one partner. These two give Lion's Mane, Enoki, Reishi and Wine Cap a second partner each.
- **Late levels are thin.** L8 adds only the Compass and L9 only auto-harvest, and after L4 the farm gains only
  two new starting boards. A new hybrid at each gives those levels something to plan around on the farm.
- **Each fills a gap.** Snow Comb is a winter crop worth growing: today winter beds are Oyster, Enoki and the
  two oyster hybrids, all worth 1–3. Claret Shelf rewards planning the bed layout around it, which no other species does.
- **Gating keeps the balance work small.** Daily years stay at level 1 and never see them, and years before L8
  are unchanged. Only the L8–L10 tiers need re-checking.

## How it plays

### Snow Comb (Lion's Mane × Enoki)

- **Crossing:** both parents grow on logs and share fall, so two log beds side by side in the fall are enough.
- **Rules:** substrate Log; seasons fall and winter; medium growth; traits `coldHardy` and `needsShade`.
- **Rule text:** "Shaded and cold-hardy. Grows through fall and winter and ignores Cold Snap, but only beside a
  Tree."
- **Riddle:** "An icicle tooth on velvet stems. Two logs, side by side, in the fall."
- **Art:** the existing `tooth` shape in frost white and pale blue, no new drawing code.

### Claret Shelf (Reishi × Wine Cap)

- **Crossing:** a log beside a woodchip bed in summer, when both are in season.
- **Rules:** substrates Log or Woodchip; seasons summer and fall; slow growth; new trait `feeder`.
- **The feeder rule:** in step 6 of the night, alongside spreaders and hungry beds, a feeder that has just
  fruited moves every adjacent bed at Spawn to Colonized. It doesn't touch blighted beds or beds already past
  Spawn. It's fixed by the board, with no dice, so the tonight preview stays exact.
- **Rule text:** "Slow. Each time it fruits, it feeds its neighbours: every adjacent bed still at Spawn jumps to
  Colonized."
- **Riddle:** "A lacquered shelf beside a burgundy cap. A log beside the chips, in the summer."
- **Art:** the existing `kidney` shape with `gloss`, in claret red with a burgundy shade.
- **Value 5,** so Lacquer Cap (6) stays "the most valuable thing your farm can grow".

### Gating

- **A new unlock type,** `{ "type": "hybrid", "id": "snowcomb" }`, on L8 and L9 in `progression.json`.
- **Before the level,** the pair doesn't cross and no prompt appears. The journal page shows the riddle plus
  "Crosses from level 8, Pathfinder." The Almanac's level list reads "A new hybrid can cross: see the Field
  journal", so the unlock doesn't give the riddle away.
- **After passing on,** the level resets with the generation, and so does the unlock.

### What else changes

- **Points:** making either one scores `hybridPoints` (3) the first time each year, like any hybrid.
- **Orders and commissions:** no new ones. "Any 2 hybrid mushrooms" and the botanist's commission count both.
- **Achievements:** "Strange Gardens" (3 different hybrids in a year) gets easier from L8. That's fine.
- **The night:** a feeder's jump shows as a new night event, "The Claret Shelf fed the Shiitake beside it."
  The tonight preview doesn't list it, since it only warns.

## Open choices for Ben

1. **Gate them by level?** Recommended: yes, L8 and L9. That gives thin levels something, keeps early and daily
   years exactly as tuned, and limits the tier re-check to L8–L10. The alternative is both from the start,
   which is simpler but means re-checking every level.
2. **Claret Shelf's new trait.** Recommended: feeder, as above. It makes bed layout a puzzle, and it can't run
   away: it only helps beds at Spawn, and Claret Shelf is slow. The alternative is existing traits only (e.g.
   slow, Woodchip or Log, no trait), which is no new rule to learn but makes it a bland value bump.
3. **Names.** Snow Comb and Claret Shelf are placeholders I'm happy with. Change freely.

## Balance

The bot makes hybrids when parents happen to sit side by side, and it often plants logs together, so the sim
will see Snow Comb at least.

- **Before and after:** `npm run sim -- 20 plan 30` and the gen sim. Compare L8–L10 median score, tier rate
  and hybrids per year.
- **The bar:** if L8–L10 tier rates rise more than about 5 points, raise `tierLift` at L8–L10 to bring them
  back. Expected: a small rise, since each hybrid is +3 at most once a year and the bot doesn't plan for them.
- **Earlier levels and daily years** must match the old sim output exactly. That proves the gate holds.

## Implementation plan

- **Data:** two entries in `hybrids.json` with `hint`s; the two unlocks in `progression.json`.
- **Engine:**
  - `Unlock` gets `{ type: 'hybrid'; id: string }`. `perksFor` collects them into a new `Perks.hybrids`.
  - `hybridFor` returns a gated hybrid only when it's in `perks.hybrids`. Called from `growth.ts` step 7 and
    the cross check in `engine.ts`. A save without `perks.hybrids` treats the gated ones as locked.
  - `SpeciesTraits.feeder`, applied in `growth.ts` step 6 with a new `feed` night event.
- **UI:** `unlockText` for the new unlock (`Progress.tsx`); the "Crosses from level N" line on locked journal
  pages (`Screens.tsx`); the `feed` line in the night report (`text.ts`).
- **Tests:**
  - The pair doesn't cross below L8 and does at L8 (engine).
  - A feeder lifts Spawn neighbours to Colonized and leaves others alone (growth).
  - `tonight.test.ts` still matches every night with the new hybrids in play.
  - The riddle test already covers the new hints.
- **Browser check at 375 px:** a locked journal page, a cross at L8, and a Claret Shelf feeding its neighbours.
- Then `docs/DESIGN.md`, a Progress entry in `review-plan.md`, and the sim numbers recorded there.
