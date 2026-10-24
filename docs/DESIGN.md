# Underbrush mobile: design notes

Sources: *Mushroom Forager — Game Spec* (Oct 23, 2026) and the *Underbrush Prototype Kit* v0.1
(solo rules, farm sheet, species/gear/hybrid cards, decks and tables). The kit's numbers are used
as-is; every one of them lives in `src/data/` so balance changes need no code.

## What the app does for the player

Following the spec's "let the app do the bookkeeping, hidden information and growth math":

| Tabletop | Mobile |
| --- | --- |
| Draw from a zone deck, count hazards | Swipe up (or tap) to draw; hazard meter, knife shield and basket count are always visible |
| Roll a d6 to identify | Card-flip reveal; the true species is hidden until you identify (specimens show only their lookalike group, e.g. "Golden funnel") |
| Pencil growth phase | Automatic overnight: animated farm, highlighted squares, and a short report |
| "May combine" hybrids | A prompt each morning: pick which bed becomes the hybrid, or keep them; declined pairs aren't re-offered |
| Season track, spoilage, Mold Bloom | Tracked and announced in the overnight report |
| Field journal pad | Persistent journal of species, hybrids and lookalikes met, plus years played and best score |
| Playtest log | Collapsible log on the festival screen: tend actions per week, unused actions, busts |

Saves happen after every action. The farm only grows when you end the week, never in real time.

## Rules as implemented

The solo kit's rules, in its order: 12 weeks, 4 actions, weather d12, then dry → crowding →
blight spread → grow → overripe → spreaders → hybrids, then the Mold Bloom check.

Interpretations where the kit left room:

- **Dry marks** are erased when a bed grows (kit wording), so they mainly build up on beds that
  are out of season, unshaded, blighted, or sitting at Fruiting.
- **Market** costs 1 action per visit, charged on the first trade, so opening the sheet to look is free.
- **Substrate finds and compost** go to a shed; laying a tile on empty ground is free.
- **Rain** advances growing beds twice (a slow bed's waiting phase counts as one step).
- **Blighted beds** can't be harvested or crossed.
- **Spreader targets** are picked with the seeded RNG when several squares qualify.
- **Score** is the kit's: delivered orders + 3 per hybrid kind made + 1 per species you planted.

## Content beyond the kit

The kit has decks only for Meadow and Mixed Woods. The spec's MVP has three zones and ten
species, and two of the ten would otherwise be unreachable, so this build adds:

- **Old-growth** (Lantern, 6 coins): Lion's Mane 4, Reishi 4, Porcini 4, Shiitake 1, Log 3, Coins+3 ×2, 6 hazards.
- **Burn Scar** (Trail Map, 5 coins, spring only): Morel 8, Woodchip 3, Coins+3 ×3, 10 hazards.
- **Porcini** (value 5, fall, lookalike Bitter Bolete on 1–2) and **Morel** (value 4, spring,
  False Morel on 1–2), both wild only.
- Real-world lookalike names for every species (Angel Wing, Redlead Roundhead, Earthball,
  Sulphur Tuft, Coral Tooth, Artist's Conk, Funeral Bell, Jack-o'-lantern, False Morel, Bitter Bolete).

All four starter hybrids are in, not just the MVP's two. Burn Bed gear is not written yet (spec to-do).

## Progression

The spec asks for a persistent journal and permanent unlocks across years, with the journal as a
light campaign. The model has three layers, all tuned in `src/data/progression.json`:

**Renown and homestead levels.** Each year's festival score becomes renown. Renown sets the
homestead's level, and each level adds something to every later story year:

| Level | Title | Renown | Unlocks |
| --- | --- | --- | --- |
| 1 | Newcomer | 0 | Meadow and Mixed Woods; shop stocks Bigger Basket, Field Guide, Knife, Dehydrator |
| 2 | Gatherer | 15 | 1 heirloom slot; Grow Tent |
| 3 | Forager | 40 | Lantern (opens Old-growth) |
| 4 | Grower | 70 | Farm grows to 5×5 (one more tree); +2 starting coins |
| 5 | Mycophile | 105 | 2nd heirloom slot; Trail Map (opens Burn Scar) |
| 6 | Steward | 150 | Farmhand: 5 actions a week |
| 7 | Elder of the Wood | 210 | 3rd heirloom slot |

Year one matches the paper-prototype plan (Meadow, Mixed Woods, the basic kit), and the content
expands from there, which is also how new biomes can slot in later. At a human score of about 20
a year, the last level arrives around year 9–10, roughly 7 hours of play.

**Heirlooms.** Before a story year starts you pack gear you've bought in earlier years, up to your
slots, and own it from week one. This is the spec's "permanent gear unlocks" with a choice attached,
so the first weeks of each year still differ.

**Species mastery.** Real identifications of a species accumulate across years. Familiar (3):
lookalikes fool you on one fewer number, so a cultivated species can no longer fail. Expert (8):
you know it on sight, and it comes home already identified, saving an action. Master (16): it
sells for a coin more. Mastery is the reward for the discovery pillar: the more you forage a
species, the more the forest gives you.

**Daily years** use the standard kit (every gear stocked, 4×4 farm, no heirlooms or mastery) so
everyone plays the same game, but they still earn renown and count toward mastery.

Two rewards target the action economy on purpose (Expert's free identification and the farmhand),
because actions are the tightest constraint in the kit's numbers.

`npm run sim -- 100 campaign` plays ten-year campaigns. The baseline bot climbs about one level
every 2–3 years, but its score stays flat (median 8–10) because it barely uses orders: it delivers
about half an order a year, so its points come from planting. So the sim checks the plumbing and
the renown pacing for a weak player. Whether the perks feel like a lift needs human playtests.

## Modes

- **Story year**: a random seed.
- **Daily year**: the seed is the date, so everyone gets the same weather and deck order that day.
  This is a cheap first step toward the spec's daily forage puzzle.

## Pacing: first numbers

`npm run sim` plays seeded years with a deliberately simple greedy bot. With the kit's values:

- Mean score about 9; roughly 1 in 10 years reaches Bronze (15+), none reach Silver.
- Tending takes about 0.7 of 4 actions a week, under the kit's "more than 1 of 3" warning line.
- Bust rate about 8% of trips.

The bot is a floor, not a skill estimate: it never plans for orders or hybrids. Even so, the
gap suggests the economy is tight. Each specimen costs three actions (forage share, identify,
plant) and stored mushrooms spoil every season. Levers to try, all in `src/data/rules.json`
and `species.json`: identify the whole basket per action, lower the tier thresholds, or let
Market not cost an action. Treat the human paper-prototype log as the real signal.

## Not in this build

Monetization and store builds (a natural demo cut is year one, levels 1–2), async co-op, expansion biomes, Riverbank/Waders, Burn Bed,
endless homestead mode. The spec's engine ("Court's stack") isn't available here; the rules
core is plain TypeScript with no DOM, so it can be ported or embedded.
