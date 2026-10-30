# The Founder's Cache: artifacts as clues to one puzzle

Ben's call (2026-10-29): one puzzle for the whole saga; solved by acting in the forest (no typing);
solvable from about half the clues; the payoff is a hidden place and the family's story ending.

## The answer

**The Hollow, under the Yew, in winter.** The Yew is a surface ground card in the Hollow deck
(Hollow opens fall and winter, needs the Compass). It ties to existing lore: the first homestead's
ruins lie under the Hollow (Fallen Walls, The Ruined Cellar, The Old Hearth).

## How it plays

- Once the family has at least one artifact in the cabinet (story mode only), a turned **ground**
  card on the **surface** (layer 0) can be dug: tap it, confirm in a sheet ("Dig under the Yew? If
  nothing's there, the day is spent and you head home.").
- **Wrong spot:** the trip ends as if you headed home (finds kept, no bust). Brute force is costly:
  18 ground kinds across 6 zones, times the seasons each zone opens.
- **Right spot:** the trip ends and the Founder's Cellar opens: a full-screen story scene (the
  place described, then the ending). The cache scores 10 festival points that year, and the journal
  records it for good; digging is no longer offered after.
- The cabinet gets a "Founder's riddle" section: the premise once any artifact is found, each found
  artifact's inscription, and after solving, the ending to re-read.
- Premise text: "Every heirloom the founder left is marked. Put the marks together and dig: the
  right spot, in the right place, at the right time of year."

## The 18 inscriptions (vague on layer 1, direct on layer 3)

Generation 2 gets all six layer-1 clues; a sharp player can solve from those alone.

| Artifact (layer) | Points to | Inscription |
|---|---|---|
| droverspenny (meadow 1) | tree | Scratched on the worn side: a little tree, green all year. |
| lanternglass (riverbank 1) | tree | Painted on the glass in faded red: berries, and the words "not for eating". |
| sixpence (mixedwoods 1) | place | Pricked into the silver: a bowl, a dip in the land. |
| lanternwick (hollow 1) | place | A label on the tin, in the founder's hand: "For the walk down into the hollow." |
| guinea (oldgrowth 1) | season | Stamped over the old king's head: a tiny six-pointed star. |
| lanternframe (burnscar 1) | season | Scratched in the soot: "Light it on the longest night." |
| rosette (mixedwoods 2) | tree | Stitched on the back: "Under the tree that was old when the house was new." |
| maptube (riverbank 2) | tree | Inked on the chart: a churchyard tree, drawn where the walls stood. |
| compassrose (burnscar 2) | place | Engraved round the rim: "Low ground, where the walls are." |
| surveyorschain (hollow 2) | place | A brass tag on the last link: "Measured from the Old Hearth: forty links." |
| blueribbon (meadow 2) | season | Embroidered on the tail: a sprig of holly and the word "Midwinter". |
| medal (oldgrowth 2) | season | On the reverse: "When nothing else will fruit." |
| stonering (oldgrowth 3) | tree | Carved inside the ring: a needled tree hung with red berries. |
| doorkey (burnscar 3) | tree | Filed into the bow, beside the family mark: a sprig of yew. |
| hearthtile (hollow 3) | place | On the back, written before firing: "The house stood in the hollow. Look above it, not below." |
| stonecap (meadow 3) | place | Carved under the cap: "I built the first house in the hollow, beside a tree older than the valley's name." |
| stonestem (mixedwoods 3) | season | Carved round the stem: "Dig when the ground is white." |
| baskethandle (riverbank 3) | season | Woven in darker willow: "Gathered in winter, when the basket is empty." |

## Implementation plan (built 2026-10-29)

- **Data:** `inscription` field on each artifact in `src/data/artifacts.json`; a `cache` block there
  too: `{ name: "The Founder's Cellar", zone: "hollow", card: "Yew", season: "winter", points: 10,
  premise, wrong, place, ending }`. Add `inscription?` to `ArtifactDef` and `cache` to `Content`
  (`src/core/types.ts`, `src/core/content.ts`).
- **Perks** (`src/core/types.ts` Perks, `perksFor` in `src/core/progression.ts`, `standardPerks` and
  `migrateState` in `src/core/engine.ts`): `clues: number` (= journal.artifacts.length) and
  `cacheFound: boolean`. Daily years: 0 / false, so no digging.
- **GameState:** `cacheFound: boolean` (migrate `??= false`). Dig allowed when story mode,
  `!perks.cacheFound && !s.cacheFound`, and `perks.clues + s.artifacts.length > 0`.
- **Engine:** new action `{ type: 'dig'; index }`: open trip, `layer === 0`, spot flipped, ground
  card. Bank relics + `restockDeck` like `stopForage`; set `trip.status = 'stopped'` and
  `trip.dug = 'found' | 'empty'` (add `dug?` to ForageTrip). Found: `s.cacheFound = true`.
  Result `{ kind: 'dig'; found: boolean }`. Export a `canDig(s, index)` helper for the UI.
- **Score:** `score()` gets a `cache` row (`s.cacheFound ? c.cache.points : 0`), shown in YearEnd's
  ScoreTable (`src/ui/YearEnd.tsx`, also used by History).
- **Journal** (`src/core/journal.ts`): `cacheFound: boolean` in Journal + emptyJournal;
  mergeDiscoveries sets it and pushes fresh `'cache'`. Check `handDown` keeps it.
- **UI:** Forage.tsx Trip: turned surface ground cards are tappable when `canDig` (small spade
  mark), confirm sheet, then dispatch. Trip-end footer: wrong dig says the founder's not here;
  found shows "Into the Founder's Cellar" opening a full-screen scene (place + ending) before
  "Back to the homestead". Cabinet in `src/ui/Progress.tsx`: Founder's riddle section. Sound cue
  in `src/ui/sound.ts` (`soundFor`) optional.
- **Tests:** dig wrong spot ends trip keeping finds; right spot sets cacheFound + scores 10; no dig
  in daily, underground, before any clue, or after found; journal records it.
- Then `npm test`, `npm run sim`, browser check, a section in `docs/DESIGN.md`.
