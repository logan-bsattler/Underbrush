# Underbrush

A cozy, turn-based mushroom foraging and cultivation game for phones, built from the
*Mushroom Forager* game spec and the v0.1 solo prototype kit. Forage the woods, identify
what you picked, grow it on a small homestead, and fill the village Harvest Festival orders
before the year ends.

It runs as a portrait, one-handed mobile web app (installable as a PWA, works offline) with
the rules in a separate, data-driven core that a native build or the tabletop version can share.

> Underbrush is a game, not a foraging guide.

## Play it

```sh
npm install
npm run dev        # http://localhost:5173, also on your LAN for testing on a phone
npm run build      # static site in dist/, deployable anywhere
```

## Develop

```sh
npm test           # rules-core tests, including 60 bot-played years as a fuzz test
npm run typecheck
npm run sim -- 500 # pacing report: score spread, tiers, tend actions per week, bust rate
```

## Layout

| Path | What lives there |
| --- | --- |
| `src/data/*.json` | All content and balance: species, hybrids, zones and their decks, gear, weather, orders, rules and tiers |
| `src/core/` | The rules engine. Pure, deterministic (seeded RNG stored in the save), no DOM |
| `src/ui/` | Preact UI: farm, forage trip, identify reveal, market, overnight report, journal |
| `scripts/` | Baseline bot and the pacing simulator |
| `tests/` | Vitest suite for the engine |
| `docs/DESIGN.md` | How the spec and kit map onto the mobile game, and open balance questions |

`dispatch(state, action)` in `src/core/engine.ts` is the only way state changes. It never
mutates its input and throws `GameError` for illegal moves, so the UI saves after every action
and can always resume.

Fonts are latin subsets of Alegreya and Alegreya Sans from the prototype kit (SIL OFL,
see `public/fonts/OFL.txt`).
