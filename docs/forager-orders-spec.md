# Forager-friendly orders: spec

Status: ready to build. Written 2026-10-28. Ben chose this fix over "just add hints".

## Problem

A year spent mostly foraging can't fill festival orders. Ben reached month 11 with a full storage of wild mushrooms (Puffball, Morel,
Porcini, Black Trumpet, Blewit, St. George's, Fairy Ring, Yellowfoot, Collared Earthstar and more). Every visible order needed
farm-grown species (Lion's Mane, Reishi, Shiitake) or hybrids, and swapping just cycled through more of the same.

## Cause

- 10 of the 18 orders in `src/data/orders.json` need at least one cultivated species.
- Most wild species never appear in any order.
- A swap sends the order to the bottom of the pile and turns up the next one without checking whether it can be filled. The deck is
  built and shuffled in `newGame` in `src/core/engine.ts` (around line 414), filtered by `requires`.

## Build

1. **Add wild orders.**
   - Add orders for specific wild species, each with the right gear `requires` so it's never dealt for a zone the player can't reach.
   - Add flexible order kinds too, such as "any 3 wild mushrooms from one zone" or "any 2 from below ground". These may need a new
     `OrderNeed` variant in `src/core/types.ts`, plus support in the engine's order-matching logic: search for "Which stored mushrooms
     an order would take".
   - Balance the points against the existing orders.
2. **Smarter swaps.** When an order is swapped, deal the first order in the pile that can be filled from storage right now, if there is
   one. Otherwise keep today's behaviour. Daily years must stay deterministic for everyone on the same seed.

## Tests

- Unit tests in `tests/` for the new order kinds and the swap rule.
- Old saves still load.
- `npm run sim` before and after: compare order fill rates and festival scores, including for a bot that mostly forages. Scores
  shouldn't jump.

## Done when

- `npm test` and `npm run build` pass.
- The sim numbers are reported to Ben.
- The market has been checked in the browser at phone width, using the `underbrush-dev` config.
- Nothing is committed or pushed unless Ben asks. The live branch `ccr-aff9be77-sfr6fw` deploys to GitHub Pages on push.
