# Tonight preview: what the night will do, before you rest

Phase 6, rank 1 in `review-plan.md`. Approved by Ben and built 2026-10-30. D4 already accepts that
this makes play easier.

## The answer

Before the month ends, the app lists the beds that will go wrong tonight and how to stop each one. The
night's rules are already fixed by the time you rest: weather is known, and growth is deterministic except
where spreaders land and what Ember Puff eats. So the preview is exact, apart from what's kept hidden on
purpose.

## How it plays

- **When:** the first tap on End month already turns the button into "Tap to rest" when actions are left.
  That state now also opens a **Tonight** panel just above the action bar. At 0 actions the first tap still
  rests straight away, unless the preview has a warning. Then it asks for the second tap too, since a market
  hand or a Puffball Supper can still fix it.
- **Not shown:** on festival morning (no night), or while away recovering (nothing can be done).
- **The panel:** up to five short lines, worst first, each with its fix where there is one. The beds named
  get a soft rust outline on the farm while the panel is open. Tapping anywhere else cancels, as now.

  | Tonight | Line | Fix shown |
  |---|---|---|
  | Dry marks | "3 beds will take a dry mark." | Water · 1 action |
  | Blight from drying | "Frost Oyster will dry out and catch blight." | Water · 1 action |
  | Crowding | "Oyster is too crowded and will catch blight." | none (compost a neighbour) |
  | Blight spreading | "Blight will creep into a neighbouring Oyster bed." | Clear blight · 1 action |
  | Overripe | "Shiitake will go overripe unpicked." | Harvest · 1 action |
  | Mold Bloom | "Mold bloom: 4 beds blighted. You'd lose an action next month." | Clear blight |
  | Spoilage | "The season turns: 5 stored mushrooms will spoil." | Sell or cook first |
  | Hybrid offer | "Oyster and Lion's Mane will offer a cross." | none (good news, listed last) |

- **Nothing to warn about:** the panel says "A quiet night: nothing will go wrong." and the button works as
  now.

## Kept hidden

- **Where a spreader lands** and **which tile Ember Puff eats.** They're random, and the review asked to keep
  them a surprise. The preview may say "Ember Puff will eat a tile beside it" without naming one.
- **Crosses with a bed a spreader is about to fill**, since listing them would give the landing away.
- **Next month's weather.** It's rolled after the night, from the real RNG, and the preview never touches it.

## Implementation plan

- **Engine** (`src/core/growth.ts`): `previewNight(s, c): NightEvent[]`. It copies only what `runGrowth`
  writes (grid squares, `compostPile`, `stats`, `pendingCrosses`, `moldPenalty`), runs `runGrowth` with a
  throwaway `Rng('preview')`, adds the season-turn `spoil` event the way `endMonth` does, and drops `grow`,
  `wait`, `spread`, `takeover` and any `cross` on a square a spread filled. `s.rng` is never read, so the real
  night and weather are untouched.
- **Text** (`src/ui/text.ts`): `tonightText(e, grid)`, future-tense lines from the table, with dry marks
  grouped into one line.
- **UI** (`src/ui/Game.tsx`, `styles.css`): the Tonight panel in the `confirmEnd` state, the 0-action rule
  above, and a `warn` square set passed to `Farm` for the outline. Lines' fix buttons open the same sheets
  as the action bar (Tend, Harvest, Market).
- **Tests:**
  - For fuzzed states, `previewNight` matches the real `endMonth` report for every event type it keeps.
  - `previewNight` leaves the state and `s.rng` unchanged.
  - A spreader's landing and a cross on its new bed never appear.
  - A text test for each line.
- **Balance:** no rule changes, and bots don't use the UI, so sims are unchanged and no `tierLift` re-check
  is needed.
- Then `npm test`, a browser check at 375 px, and a section in `docs/DESIGN.md`.
