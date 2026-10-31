# Founder's afterword: the cellar's journal becomes a book the family keeps reading

Phase 6, rank 5 in `review-plan.md`. Approved by Ben and built 2026-10-30, with both open choices as
recommended. Page 7 was reworded in the build so it doesn't contradict the cellar's ending ("the last page is for
whoever found it"): "That's the last of my own story. The blank pages at the back of this book are yours." Follows the Founder's Cellar
(`founders-cache-spec.md`).

## The answer

Once the family finds the Founder's Cellar, the founder's riddle in the cabinet turns into **the founder's
journal**: a book with three parts the family keeps for good.

1. **Pages.** One page of the founder's own story is read when the cellar opens, and one more each generation
   after. Seven pages in all; the last says the rest of the book is blank and the family's to fill.
2. **Below.** A note on each of the six third-layer places: which heirloom the founder left there, and how
   many of each hazard lie between it and you. Plus one line of advice: bring the stones home first.
3. **Pairings.** For every hybrid the family has never made and the homestead can grow now, the founder names
   the two parents outright.

Information only: no points, no perk, no rule change. One new field is saved (the generation that found the
cellar), so the page count can follow the generations.

## Why

- **The cellar is a one-time payoff today.** It's found as early as generation 2 and then the riddle section
  just shows the ending. The afterword turns it into a thread: every hand-down after it reads a new page.
- **Generation 5 onward gets nothing new.** Layers stop at the third, so `generationLore` returns nothing after
  generation 4 and the Pass it on section goes quiet. A founder's page fills that gap for any family that has
  found the cellar.
- **The third layer is the hardest call in the game.** A fall there costs a whole month at home. Telling the
  player which piece lies where and how many hazards wait is real help with that call, without softening it.
- **Hybrid riddles exist, so this is the next step up.** The field journal's riddles describe the parents; the
  founder, who knew every mushroom in the valley, just names them. It only moves a first discovery earlier,
  which the hybrid hints spec already accepted.

## How it plays

- **When:** the moment the cellar opens, the riddle section in the cabinet is renamed "The founder's journal"
  and shows page 1. Nothing changes before the cellar is found.
- **Pages by generation:** pages read = generations since the cellar was found, counting the one that found
  it, capped at seven. A family that finds it in generation 2 reads page 4 in generation 5 and the last page
  in generation 8.
- **Where a new page shows:** at the top of the founder's journal, marked "new" until the cabinet is next
  opened, and in Pass it on under the generation's lore line as "From the founder's journal: …". For
  generation 5 and later, which have no layer lore, it's the only lore line there.
- **Layout of the founder's journal**, in the cabinet, under the six sets:
  - The cellar, found: the place and ending (today's text), collapsed to its first line with "Read again".
  - Pages: the pages read so far, newest first.
  - Below: the advice line, then six notes, one per third-layer place. A note whose piece is already in the
    cabinet stays, with a tick.
  - Pairings: one line per unmade, unlocked hybrid. Once all are made: "You've grown everything the founder
    wrote down."
  - The marks: the 18 inscriptions, as today, collapsed under "The marks".
- **Daily years:** unchanged. The book is family lore, so it lives in the story journal only.
- **The bots:** never read it. No sim change.

## The pages

| # | Read in | Page |
|---|---|---|
| 1 | The generation that finds the cellar | The first winter I lived on what the snow didn't hide. I learned this valley the way you learn anything: by being wrong about it, and living. |
| 2 | One generation later | A drover came through one spring and lost his purse along the way, a coin here and a coin there. I found them for years after, one under each wrong tree. I never gave them back. I put them somewhere better. |
| 3 | Two later | At the first Harvest Festival I won every ribbon, because I was the only one who knew which mushrooms wouldn't kill the judges. The next year they asked me to judge instead. |
| 4 | Three later | A mapmaker stayed a summer and charted every hole under the valley. He paid for his keep with his kit, and I hid the pieces where his own maps said no one would look. |
| 5 | Four later | The Hollow floods in a wet spring. After the third flood I moved us up to where the homestead stands now. I left the hearth behind so the old house would know we'd be back. |
| 6 | Five later | My hands are slow now. The grandchildren tell my stories wrong, and I let them. A wrong story still sends you walking, and walking is how you learn the woods. |
| 7 | Six later | That's the last of my pages. The rest of this book is blank, and it's yours. Write down what you find. |

## Below: the third-layer notes

The advice line, shown first: **"Fetch the stone mushroom before anything else down there. Whole, it lands
every fall one layer softer, and a fall that deep costs a month."** (True to the rules: with the Mushroom
Stones a third-layer fall costs 2 actions instead of the whole month.)

Each note is the founder's sentence, then a hazard line built from `underground.json` so it can't drift from
the decks.

| Place (zone) | Piece | Founder's note | Hazard line (generated) |
|---|---|---|---|
| The Spring Below (meadow) | Stone Cap | I dropped the cap down the old well, and the water carried it to the spring underneath. | 3 Deep Water, 3 Rockfall |
| The Taproot Hall (mixed woods) | Stone Stem | The stem I pushed down along the big oak's taproot, all the way to the hall at the bottom. | 3 Rockfall, 3 Dead End |
| The Glowing Grotto (old-growth) | Stone Ring | The ring is in the grotto where the mushrooms give their own light. It shows you the way, not the drops. | 3 Sheer Drop, 3 Rockfall |
| The Ash Vault (burn scar) | Iron Door Key | I left the door key in the vault under the kiln. It's the driest place in the valley, and the worst place to breathe. | 4 Smoke Pocket, 3 Crumbling Brick |
| The Sunken Mill (riverbank) | Willow Basket Handle | The basket handle hangs in the old mill under the river, where the wheel still turns. | 3 Deep Water, 3 Strong Current |
| The Old Hearth (hollow) | Hearth Tile | The hearth tile is where our first fire was. Go gently; it was home. | 3 Falling Stone, 3 Collapse |

The note names the piece, which the cabinet doesn't today (it says "Not yet found, somewhere in the 3rd layer
below the X"). The Ash Vault's extra hazard is the one real difference between the six, and this is where a
player learns it before going down.

## Pairings

Built from `hybrids.json`, no new text per hybrid: **"Shaggy Oyster: Oyster beside Lion's Mane."** Listed only
for hybrids the family has never made (`journal.hybrids`) and the current level has unlocked, so Snow Comb and
Claret Shelf stay out until levels 8 and 9. Pass the homestead on and they drop out again until the new
generation reaches those levels.

## Open choices for Ben

1. **How plain the pairings are.** Recommended: name both parents, as above. The founder knew every mushroom,
   and the riddle already gets a careful player there. The alternative is a second, plainer riddle per hybrid
   ("Oyster's shelf with a lion's beard"), which keeps a little puzzle but needs six new lines of text and
   reads close to the riddle it follows.
2. **Pages on a timer of generations, or all at once.** Recommended: one per generation, as the plan says,
   so passing the homestead on always brings something. The alternative is all seven pages the moment the
   cellar opens, which is simpler but leaves late generations with nothing new again.

## Implementation plan

- **Data** (`src/data/artifacts.json`, `cache` block): `afterword: { pages: string[], advice: string, below:
  Record<zoneId, string> }`. Types in `src/core/types.ts` (the cache type) and `src/core/content.ts`.
- **Journal** (`src/core/journal.ts`): `cacheGeneration?: number` in Journal. `mergeDiscoveries` sets it to
  `s.perks.generation` the year the cellar is first found. `normalizeJournal` fills it for saves that found the
  cellar before this: the generation of the year record whose `breakdown.cache` is above 0, else the current
  generation. Check `handDown` keeps it.
- **Helpers** (`src/core/underground.ts` or a new `src/core/afterword.ts`): `afterwordPages(j)` (pages read,
  by generation), `belowNotes(j)` (six notes with zone, depth-3 layer, piece, found flag and hazard counts from
  the layer deck), `pairings(j, level)` (unmade, unlocked hybrids with parent names).
- **UI:** `src/ui/Progress.tsx` `Riddle` becomes `FounderJournal` once `j.cacheFound`: the parts in the order
  above, with `<details>` for the cellar text and the marks. `Legacy` shows the latest page under the lore
  line, or alone when `generationLore` is null. The "new" mark: compare pages read with a
  `underbrush:afterword-seen` count in localStorage (per-device convenience, not saved game state).
- **Tests:** page count by generation and the cap at seven; `cacheGeneration` set once and migrated for old
  saves; hazard counts match the layer decks; pairings skip made and level-locked hybrids; nothing shows before
  the cellar is found.
- Then `npm test`, a phone-width browser check (375 × 812) on a dev save with the cellar found, and a section
  in `docs/DESIGN.md`. No points, so no sim or `tierLift` re-check.
