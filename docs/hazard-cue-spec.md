# Hazard cue: a soft knock for each hazard beside the card you turn

Rank 9 on the Phase 6 list (`review-plan.md`), size S. Drafted 2026-10-30. **Approved 2026-10-30 as recommended**
(lower and slower on the edge, silence after a 0), to be built before rank 8. **Built 2026-10-30.** The cue also carries `under` for the echo below ground.

## The answer

When you turn a card that isn't a hazard and it has hazards beside it, its sound is followed by soft, muffled knocks,
one for each hazard, like footsteps on a hollow log. A card with none beside it plays its usual sound and nothing
more. When the next counted hazard would bust the trip, the knocks drop lower and slow down.

## Why

- **It adds tension without adding danger.** The knocks only repeat the number the card already shows, so the
  rules and the odds stay exactly the same.
- **The ear reads it before the eye.** Three knocks after a find make you hesitate before the next tap, even
  before you look at the number. A card that turns in silence is a small relief.
- **It must never give anything away.** The cue plays only for a card you've turned, from the number now on
  screen. It never plays on press, on hover or for a face-down card, so it can't be used to sweep the patch.
- **It's small.** It's one new voice in `sound.ts` and two fields on the cue, and the bots don't use sound.

## How it plays

- **When:** you turn a card that isn't a hazard, the trip is still open afterwards, and the card's number is above 0.
  This covers mushrooms, substrate, coins, plain ground, the way down, artifacts and rare finds, on the surface
  and below.
- **What:** one knock per hazard beside the card, up to four. That's every case on the surface. If the
  Old-growth's diagonal rule from rank 8 is built, a number above 4 still plays four knocks, the last one lower.
- **The sound:** a short, muffled knock, a triangle tone around 150 Hz through a lowpass with a soft noise tap
  at about 500 Hz. Phone speakers lose most sound below about 250 Hz, so the tap is what carries on a phone and
  the low tone fills it out on headphones. Each knock is quieter than the card's turn sound, so it sits under it.
- **Timing:** the knocks wait for the card's own sound: about 0.1 s after a plain turn, 0.3 s after a find or
  coins and 0.5 s after a rare find, then 0.16 s apart. Four knocks take about 0.6 s. A quick next tap doesn't cut
  them off.
- **On the edge:** when the next counted hazard ends the trip (one below `bustAt`, with the Knife spent or
  absent), the knocks are a few semitones lower and 0.22 s apart. It's the same count, said more slowly.
- **Below ground:** the knocks get a little more echo, to match the layers' drip and rumble.
- **Settings:** they follow the Sound toggle and have no switch of their own. Music doesn't affect them.
- **No new vibration.** The buzz on a hazard and on a bust stays as it is. A buzz per knock would be too much on a
  phone.

## Open choices for Ben

1. **On the edge.** Recommended: **yes**, lower and slower when one hazard from a bust. That's where the tension
   matters. Without it, the knocks sound the same on every turn.
2. **Zero.** Recommended: **silence** after a 0, so the missing knock is the relief. The alternative is a light,
   airy chime on a 0. That rewards the safe card, but it adds a sound to the most common turn.

## Balance

None. The bots don't play sound and no rule changes, so there's nothing to re-sim.

## Implementation plan

- **`sound.ts`:**
  - `Cue` gains `near?: number` and `edge?: boolean`.
  - In `soundFor`, a `draw` result that isn't `hazard`, `hazardIgnored` or `bust` sets `near` from
    `hazardsNear(s.forage, r.index)`, and `edge` from `s.forage.hazards === bustAt(s) - 1` with no unspent Knife.
  - `play(sfx, n, cue?)` schedules the knocks after the effect, using an offset for each effect (`flip`, `find`,
    `coins`, `rare`, `wayDown`).
  - A new voice, `knock(c, out, at, low, wet)`.
  - Everything goes through `safely` as now. `restSoon` already allows for echo tails, so the knocks don't keep
    audio awake any longer.
- **`store.ts`:** pass the whole cue to `play`.
- **Tests (`tests/sound.test.ts`):**
  - `soundFor` gives `near` equal to `hazardsNear` for a turned card with hazards beside it, and no `near` for 0.
  - A hazard, a hazard ignored by the Knife and a bust never get `near`.
  - `edge` is set at one hazard below a bust, and not while the Knife is unspent.
  - `play` with knocks never throws without Web Audio.
- **Checking it:** I can't hear the browser pane, so the browser check only confirms the cue values in the console
  (`audioState` plus a dev log of the last cue) on a real patch. Ben judges the sound itself on his phone, with the
  speaker and with headphones, and we tune the gain and pitch from there.
- Then a short note in DESIGN.md and a Progress entry in `review-plan.md`.
- **Order:** it doesn't depend on rank 8, so it can be built first. If the quiet is built later, the cap of four
  knocks already covers its larger numbers.
