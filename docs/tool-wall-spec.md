# Tool wall: the gear you own, hung on the shed

Phase 6, rank 2 in `review-plan.md`. Approved by Ben and built 2026-10-30, with both open choices as
recommended.

## The answer

A plank of pegboard runs under the farm: the shed's outside wall. Each piece of gear you own hangs on its own
peg, and heirlooms carry a small brass tag. Gear the Market stocks this year that you don't own yet shows as a
painted outline on an empty peg, the way a workshop marks where each tool goes. So the wall fills up over the
year and fills up faster in later generations. Tapping it lists what you own and what each piece does.

There are no rule changes. It's art plus one sheet.

## How it plays

- **Where:** a strip about 34 px tall, the farm's full width, between the farm and the tray. At 375 × 812 there
  are 68 px free there today. The Shed tray group is only 129 px wide, too narrow for ten tools.
- **What hangs:** ten pegs in a fixed order, so nothing shifts when you buy. Drip Line and Grow Tent are left off
  because the farm already draws them (the hose and the tent badge).

  | Group | Pegs, left to right |
  |---|---|
  | Zone keys | Lantern, Trail Map, Waders, Compass |
  | Field tools | Mushroom Knife, Spade, Bigger Basket, Field Guide |
  | Homestead | Blight Spray, Dehydrator rack |

- **Peg states:**

  | State | Drawn as |
  |---|---|
  | Owned | The tool in colour, hanging |
  | Owned as an heirloom | The same, plus a small brass tag on the peg |
  | Stocked this year, not owned | A pale painted outline of the tool |
  | Not stocked yet (level-locked) | A bare peg, no outline |

- **Buying:** the new tool drops onto its peg with a small swing the next time the farm shows. No motion under
  `prefers-reduced-motion`.
- **Tap the wall:** a **Tool wall** sheet. Owned gear first, each with its name, "Heirloom" where it applies, its
  use line and its rule (from `gear.json`). Then the outlined gear with its cost. A Market button at the
  bottom. Today the only place to see what you own is the Market's full gear list.
- **Not shown:** on the small farm on the night screen, and on the forest screen.
- **Screen reader:** the wall is one button, labelled like "Tool wall: Lantern, Spade (heirloom), Mushroom Knife.
  3 more at the Market."

## Art

Seven new icons in `art.tsx`, drawn in the same style as the existing ones (24-unit viewBox, 1.4–1.5 strokes,
the earthy palette): lantern, trail map, waders, compass, field guide, blight spray and dehydrator rack. Knife,
spade and basket already exist and are reused. Each icon also needs an outline-only version for the painted
mark; a CSS class that drops the fill and lightens the stroke should cover it, so there's no second set to draw.

The plank is weathered wood with peg holes, matching the shed icon's tan. The brass tag uses the coin gold.

## Open choices for Ben

1. **Painted outlines for gear not yet owned.** Recommended: yes. They show what's left to buy and give the wall
   a shape to fill. The alternative is owned gear only, which is simpler but starts the year as a bare plank.
2. **Small farms and short phones.** If the strip would push the action bar off a 375 × 667 screen, it shrinks to
   24 px with smaller icons rather than hiding. I'll check this in the browser.

## Implementation plan

- **Art** (`src/ui/art.tsx`): the seven icons, plus a `ToolWall` drawing the plank and pegs.
- **UI** (`src/ui/Game.tsx`): the strip under `Farm` on the farm screen, outside the `Farm` memo so a forest card
  flip still leaves it alone. It reads `g.gear`, `g.perks.heirlooms` and `g.perks.shop` only. The Tool wall
  sheet as a new `sheet` kind, with a Market button that opens the existing Market sheet.
- **Styles** (`src/ui/styles.css`): the strip, outline state, brass tag, swing animation and reduced-motion rule.
- **Balance:** none. No rules change and bots don't use the UI, so no sim and no `tierLift` re-check.
- **Tests:** no engine change, so no new engine test. `npm test` and the type check must pass. Browser check at
  375 × 812 and 375 × 667: a fresh year with nothing owned, a year with heirlooms, and a purchase.
- Then a short section in `docs/DESIGN.md` and a Progress entry in `review-plan.md`.
