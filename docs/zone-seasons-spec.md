# Zone seasons: a prime season, a winter floor, and a floor that looks the part

Not on the Phase 6 list; Ben asked for it 2026-10-30. It sits beside rank 8 (one rule per zone), which it does not
replace. **Approved 2026-10-30, flavor only:** Ben kept the seasonal names (for hazards and ground cards, in every
season that reads well, not just winter) and the art and backgrounds. He dropped the prime season. The sections
below on prime seasons and balance are kept for the record but were not built. With no rules change, no sim or
tier re-check is needed.

## The answer

The three zones that are open all year (the Meadow, the Mixed Woods and the Old-growth) get three changes. Each
one keeps the deck the same size and keeps every hazard:

| | What changes | Rules or flavor |
|---|---|---|
| **A prime season** | Each zone has one season when 2 of its ground cards become 2 mushroom cards: the Meadow in spring, the Mixed Woods in summer, the Old-growth in fall | Rules: more finds, the same hazards |
| **A winter floor** | In winter, Ticks become Black Ice and Sudden Rain becomes Sleet, and the ground cards get winter names | Flavor: hazards all play the same |
| **A floor that looks the part** | The patch and its ground, brush and tree cards take the season's colors, with snow, fallen leaves or spring buds, as the farm does already. This applies in every zone | Looks only |

The zone picker marks the zone in its prime: "In its prime this spring".

## Why

- **Seasons already shape the year, but not the walk.** The season decides which zones are open (the Burn Scar
  in spring, the Riverbank from spring to fall, the Hollow in fall and winter) and which wild finds are dealt.
  But the three zones open all year deal the same floor in March and in January. In the Meadow only the deep
  finds change, because its main deck has no wild species.
- **A prime season turns "where to forage" into a calendar choice.** Today a zone's pull is the same in every
  season (apart from its deep find). With a prime season for each zone, spring points to the Meadow, summer to the Mixed Woods and
  fall to the Old-growth. Winter has no prime zone on purpose: it belongs to the Hollow and the truffle.
- **Keeping deck size and hazards fixed keeps the risk the same.** The hazard numbers on a patch work out just
  as they do today, so the walk is no more dangerous, in line with "danger is flavor". Only the number of finds
  goes up, and the sims can measure that.
- **Ticks in January read wrong.** Changing the names in winter costs almost nothing and makes the season felt on
  every trip. Hazards play the same whatever they're called, so this doesn't touch balance.
- **The art is already drawn.** The farm's grass, canopy, snow, leaf and bud palettes (`art.tsx`, `grass` and
  `canopy`) only need passing to the forage icons.

## How it plays

### Prime seasons

| Zone | Prime season | Out | In | Why that season |
|---|---|---|---|---|
| Meadow | Spring | 2 Tall Grass | 2 Wine Cap | New grass and fresh chips. The year opens here, so a first-year player gets more finds |
| Mixed Woods | Summer | 2 Leaf Litter | 1 Chanterelle, 1 Lion's Mane | Chanterelle is the woods' summer find, and Lion's Mane comes into season |
| Old-growth | Fall | 2 Moss | 1 Porcini, 1 Reishi | Porcini is fall-only, and Reishi is the valuable fall crop |

- Every card that comes in is in season during its zone's prime season, so it's dealt in that season.
- **When it changes:** at the season turn, the zone's deck is rebuilt. The incoming cards join the draw pile and
  the outgoing ground cards leave it. At the next season turn they swap back. Cards already turned this month are
  not affected.
- **Picker:** a line on the zone card reads "In its prime this spring: 2 more finds". It sits under the
  "Deep in, this spring" line and is styled like it.
- **Daily years** get it too. They're level 1, and the Meadow and Mixed Woods are open there, so a daily spring
  and summer each have a prime zone.

### The winter floor

In winter, cards in the three all-year zones take these names:

| Today | In winter | Reveal |
|---|---|---|
| Ticks | Black Ice | the `slip` reveal |
| Sudden Rain | Sleet | the `rain` reveal |
| Lost Trail | Whiteout | unchanged |
| Tall Grass / Bare Earth | Frosted Grass / Frozen Ground | — |
| Leaf Litter / Moss | Snow-covered Litter / Frosted Moss | — |

- These are names only. The card's identity doesn't change, so hazard counts, the dig rule (Oak and Hazel Scrub
  keep their names) and the founder's cache all behave as before.
- **Trip log and bust text** use the winter name: "Black Ice: a second hazard ends the trip."
- The Burn Scar, Riverbank and Hollow keep their names. They already have a season of their own.

### The look

- The patch's background wash and the `ground`, `brush` and `tree` icons take the season. Spring brings green
  buds, summer full green, fall amber with a few fallen leaves, and winter grey-green with a snow edge. These
  are the farm's colors.
- In the picker, the wash on each zone card shifts a little with the season.
- **The underground stays the same all year.** The layers below don't feel the season, which sets them apart
  from the surface.
- Reduced motion has no effect, since none of this moves.

## Open choices for Ben

1. **The shape of the rules change.** Recommended: **a prime season only**, as above. The alternatives:
   - *Prime plus a lean winter*: in winter, the three zones also lose 2 mushroom cards to ground. That's closer
     to real life, but a daily winter at level 1 has nowhere good to go.
   - *Cultivated cards follow their own seasons*: Wine Cap is dealt only in spring and summer, and so on. That's
     the most true to life, but the winter Meadow would deal no mushrooms at all and spring would lose Puffball.
     It's a big cut at low levels and would need tiers re-tuned from L1.
2. **Which season is each zone's prime.** Recommended: the table above, so spring, summer and fall each get one.
   Change freely.
3. **Seasonal names.** Recommended: winter only. The alternative is names for all four seasons (Mosquitoes in
   summer, Mud in spring), which is more to write for less effect.
4. **The look.** Recommended: yes, in every zone. It's the cheapest part and works without the other two.

## Balance

- **Expected:** a small rise at every level, from 2 extra finds in the prime zone for a quarter of the year. My
  guess is +1 to +2 median points, with most of it in the Old-growth's fall (Porcini is worth 5).
- **Measure:** run `npm run sim -- 20 plan 30`, the gen sim and the baseline sim before and after. Compare tier
  rates and medians per level, plus daily-year tiers (level 1, from the baseline sim).
- **The bar:** if any level's tier rates rise by more than about 5 points, raise `tierLift` there. If daily
  years rise by more than 5, cut a prime swap to 1 card rather than tuning the daily tiers.
- **Bot:** the planner's zone scoring reads the deck, so it has to see the prime cards in their season, and
  only then. Check that it actually goes to the Meadow in spring and the Old-growth in fall, and that this
  isn't just noise.

## Implementation plan

- **Data (`zones.json`):** `"prime": { "season": "spring", "out": "Tall Grass", "in": [{ "species": "winecap",
  "copies": 2 }] }` on the three zones, and `"winterNames": { "Ticks": "Black Ice", ... }`.
- **Types:** `ZoneDef.prime` and `ZoneDef.winterNames`.
- **Engine:**
  - `buildDeck` stays the printed deck.
  - At each season turn (`endMonth`, where the season event is pushed), `applyPrime(s, zone, season)` adds the
    prime cards to the draw pile, or removes them from draw and discard, and does the reverse with the outgoing
    ground cards.
  - The year's first deal (spring) applies the Meadow's prime at setup.
  - `zoneStatus`/a new `primeNow(zone, season)` for the UI and the bot.
- **Text:** `cardTitle(card, zone, season)` resolves winter names. The trip log, bust text and `hazardKinds` get
  entries for the new names (Black Ice → `slip`, Sleet → `rain`).
- **Art (`art.tsx`, `Forage.tsx`):** `Icon` takes an optional `season` for `ground`, `brush` and `tree`, reusing
  `grass`/`canopy`. `CardArt` and the patch pass the current season, except underground. The picker's zone wash
  gets a season tint.
- **Bot (`scripts/bot.ts`):** zone scoring uses the deck as it stands, prime cards included.
- **Tests:**
  - Each zone deals its prime cards only in its prime season, with deck size and hazard count unchanged in
    every season.
  - Cards swap back at the next season turn.
  - Winter names show in winter in the three zones, and never in the Hollow.
  - The dig rule still finds truffles under a winter Oak.
  - `tonight.test.ts` and the founder's cache tests still pass.
- **Browser check at 375 px:** a spring Meadow with the picker line, a winter Mixed Woods with Black Ice and snow
  icons, a fall Old-growth patch, and an underground layer that stays the same in winter.
- Then `docs/DESIGN.md`, a Progress entry in `review-plan.md`, and the sim numbers recorded there.
