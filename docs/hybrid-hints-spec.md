# Hybrid hints: riddles for the hybrids you haven't made

Phase 6, rank 3 in `review-plan.md`, first half. Approved by Ben and built 2026-10-30, with both open choices
as recommended. Three riddles were reworded in the build so each uses its parents' journal looks word for word
(the table below is final). The second half, one or two new hybrids, gets its own spec.

## The answer

Each hybrid you haven't made yet shows a riddle on its Field journal page instead of today's one generic line.
The riddle describes the two parents by the looks the journal already uses for unknown species ("Pale shelf",
"Icicle tooth"), says where they grow, and says when they overlap. Once you've grown both parents, a plain
line is added under it: "You've grown both halves of this one." Making the hybrid fills the page as it does
today, parents and all.

No rule changes, no new saved state. It's four lines of text and a few lines of UI.

## Why

- **Discovery is luck today.** A hybrid only appears if two parents happen to sit side by side. The four
  unknown pages all say the same thing, so there's nothing to chase.
- **The journal already has the vocabulary.** Unknown species show their group name ("Brown log cap",
  "Lacquered shelf"). The riddles reuse those words, so a player can match riddle to plate.
- **It costs no balance.** Once a hybrid is made, the journal shows its parents anyway. Riddles only move the
  first discovery earlier. The bots never plan hybrids, so the sim can't see it either way.

## The riddles

| Hybrid | Parents | Riddle |
|---|---|---|
| Shaggy Oyster | Oyster × Lion's Mane | A pale shelf with an icicle tooth beard. Look where the straw meets the logs. |
| Lacquer Cap | Shiitake × Reishi | A brown log cap glazed like a lacquered shelf. Two logs, side by side, in the fall. |
| Ember Puff | Wine Cap × Puffball | A white orb under a burgundy cap. Chips beside compost, in the summer. |
| Frost Oyster | Oyster × Enoki | A pale shelf on velvet stems, rimed with frost. Straw beside a log as the year turns cold. |

Each riddle names both parents' groups, their substrates and a season both grow in. It never names a species
outright.

## How it plays

- **Where:** the Field journal (`Journal` in `Screens.tsx`), on each unknown hybrid page, in place of "Grow two
  compatible species side by side to discover it." The "?" art stays.
- **The second line:** shown when both parents are in `journal.discovered`. It tells a player who has the
  pieces that the answer is already on their farm. Nothing is shown about one parent alone.
- **Once made:** the page fills in as today and the riddle goes away. The Parents row already names them.
- **Screen reader:** the riddle is plain text on the page, so it reads in order with no extra labels.
- **Not shown:** on the farm, the night screen or the cross prompt. The journal is where you go looking.

## Open choices for Ben

1. **How plain the riddles are.** Recommended: as above, group names plus substrate and season. That's enough
   to solve with the journal open, and still a small puzzle. The alternatives are vaguer riddles (looks only,
   no substrate or season), or naming the parents outright, which makes it a recipe list.
2. **The "both halves" line.** Recommended: yes. It's a gentle second step for players who are stuck, and it
   costs no saved state. The alternative is the riddle alone.

## Implementation plan

- **Data** (`src/data/hybrids.json`): a `hint` string on each hybrid. `hint?: string` on `SpeciesDef` in
  `types.ts`.
- **UI** (`src/ui/Screens.tsx`): the unknown hybrid page shows `sp.hint`, then the "both halves" line when
  both `sp.parents` are discovered. Falls back to today's line if a hybrid has no hint.
- **Styles:** the riddle in the journal's italic note style. Likely no new CSS.
- **Balance:** none. No sim, no `tierLift` re-check.
- **Tests:** a content test that every hybrid has a hint and that no hint contains a parent's name (so a
  future hybrid can't ship as a recipe by accident). `npm test` and the type check must pass. Browser check at
  375 px: a fresh journal, a journal with both Oyster and Lion's Mane grown, and one with Shaggy Oyster made.
- Then a short section in `docs/DESIGN.md` and a Progress entry in `review-plan.md`.

## Later: new hybrids (rank 3, second half)

Not part of this build. Only 4 of the 21 cultivated pairs cross today, and every cultivated species except
Oyster has exactly one partner. Pairs that would fit, for that spec to choose from:

- **Lion's Mane × Enoki**: both on logs, both in fall. Gives each a second partner.
- **Reishi × Wine Cap**: log beside woodchip, in summer. Gives each a second partner.

Each new hybrid adds 3 festival points the first time it's made each year, so that spec needs a `tierLift`
re-check, plus art, a rule and possibly a new trait in `growth.ts`.
