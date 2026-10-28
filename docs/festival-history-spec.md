# Festival history: spec

Status: ready to build. Written 2026-10-27.

## Goal

Let the player look back over every festival they've finished: the score, the tier and how the points were made. Today each finished year
saves only a one-line summary, and nothing in the game lists past years.

## What exists today

- `recordYear` in `src/core/journal.ts` appends a `YearRecord` to `journal.years` once per seed when a year ends. It holds
  `finished`, `mode`, `seed`, `score`, `tier`, `renown`, `levelFrom`, `levelTo` and `masteryUps`.
- The score breakdown (`score()` in `src/core/engine.ts`: orders, hybrids, planted, coins, feast, artifacts, family, total, tier) is
  computed on the festival screen (`src/ui/YearEnd.tsx`) from the finished `GameState`. That state is replaced when the next year starts,
  so the breakdown is lost.
- `journal.years` is read only for best score and year count (`Screens.tsx`), today's daily (`Screens.tsx`), the story-year count
  (`Progress.tsx`) and the festival screen's `RenownPanel`.
- The journal lives in localStorage under `underbrush:journal:v1` and goes through `normalizeJournal`, so old saves must keep loading.

## Part 1: save more with each year

Add optional fields to `YearRecord`. Optional, because years already recorded won't have them:

| Field | Source | Why |
|---|---|---|
| `breakdown?` | `score(s)` without `tier` and `total`: `{ orders, hybrids, planted, coins, feast, artifacts, family }` | The points table |
| `board?` | `s.board` | "Story year on Meadow Edge" |
| `generation?` | `s.perks.generation` | Groups years by generation in the list |
| `challenges?` | `s.perks.challenges` | Legend years show which challenges were on |
| `orders?` | `s.orders.filled` (order ids) | Which orders were delivered |
| `hybrids?` | `s.hybridsMade` | Which hybrids were made |
| `artifacts?` | `s.artifacts` | Which artifacts came up |

Keep it small: ids only, no labels or copies of content. Names are looked up from `content` when shown, with a fallback to the raw id
when content no longer has it, the same way `YearEnd.tsx` already does for artifacts.

`recordYear` fills these in. Don't change `normalizeJournal` to backfill them: old records stay without them.

## Part 2: a Festival history screen

- **Entry point:** a "Past festivals" button on the Almanac (`Almanac` in `src/ui/Progress.tsx`), shown once `journal.years` has
  at least one entry. Wire the screen into the routing in `src/ui/App.tsx` like the Almanac.
- **List:** newest first. Each row: date (from `finished`, local date only), mode (Story or Daily with its date from the seed), board
  name if known, score, and tier name ("A quiet year" when `tier` is null). Show the generation as a small label from generation 2 on.
  The best year gets a small marker.
- **Detail:** tapping a row expands it in place (no new screen). It shows renown earned and level before and after, mastery ups,
  and, when the record has them, the points table in the same layout and wording as `YearEnd.tsx`'s score table, plus the orders,
  hybrids, artifacts and challenges. For an old record without `breakdown`, show one muted line: "Recorded before the full score
  card was kept."
- **Empty state:** none needed, since the button only appears once a year is finished.
- Reuse the existing classes (`screen paper`, `score-table`, `tier`) and the season/paper look. No new art.
- Must work at phone width with no horizontal scroll.

## Out of scope

- Syncing history across devices or browsers.
- Replaying or rebuilding an old year from its seed.
- Charts or trends.
- Changing how renown, best score or the year counts are worked out.

## Tests

- `recordYear` writes the new fields, and the breakdown sums to `score`.
- A journal saved before this change (records without the new fields) still loads through `normalizeJournal`, and the screen
  handles those records.
- Recording the same seed twice still adds only one record.

## Done when

- The new fields are saved for every year finished after the change.
- The Almanac has a "Past festivals" screen listing every recorded year, with the detail view, and old records show their one-line note.
- `npm test` and `npm run build` pass, and the screen has been checked in the browser at phone and desktop width.
