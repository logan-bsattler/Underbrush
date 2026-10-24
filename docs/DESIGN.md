# Underbrush mobile: design notes

Sources: *Mushroom Forager — Game Spec* (Oct 23, 2026) and the *Underbrush Prototype Kit* v0.1
(solo rules, farm sheet, species/gear/hybrid cards, decks and tables). The kit's numbers are used
as-is; every one of them lives in `src/data/` so balance changes need no code.

## What the app does for the player

Following the spec's "let the app do the bookkeeping, hidden information and growth math":

| Tabletop | Mobile |
| --- | --- |
| Draw from a zone deck, count hazards | Turn cards on a dealt patch of forest floor that tells you where hazards are (see below); hazard meter, knife shield and basket count are always visible |
| Roll a d6 to identify | One Identify action checks the whole basket, each specimen with its own roll, revealed card by card; the true species is hidden until then (specimens show only their lookalike group, e.g. "Golden funnel") |
| Pencil growth phase | Automatic overnight: animated farm, highlighted squares, and a short report |
| "May combine" hybrids | A prompt each morning: pick which bed becomes the hybrid, or keep them; declined pairs aren't re-offered |
| Season track, spoilage, Mold Bloom | Tracked and announced in the overnight report |
| Field journal pad | Persistent journal of species, hybrids and lookalikes met, plus years played and best score |
| Playtest log | Collapsible log on the festival screen: tend actions per month, unused actions, busts |

Saves happen after every action. The farm only grows when you end the month, never in real time.

## Rules as implemented

The solo kit's rules, in its order: 12 rounds (the kit calls them weeks; the app calls them months,
since 12 make a year), 4 actions, weather d12, then dry → crowding → blight spread → grow →
overripe → spreaders → hybrids, then the Mold Bloom check.

After month 12's growth there is no month 13. Instead a **festival morning** gives one last harvest
and one market visit (sell, deliver one order), neither costing an action, so fruit that ripens on
the last night still counts. Nothing else is possible that morning, the shop sells no gear, and a
hybrid offered on the last night can still be made before the festival scores the year.

Interpretations where the kit left room:

- **Dry marks** are erased when a bed grows (kit wording), so they mainly build up on beds that
  are out of season, unshaded, blighted, or sitting at Fruiting.
- **Market** costs 1 action per visit, charged on the first trade, so opening the sheet to look is free.
- **Substrate finds and compost** go to a shed; laying a tile on empty ground is free.
- **Selling compost** (not in the kit): Compost tiles in the shed sell at the market for 1 coin
  each (`rules.compostValue`, +1 on Market day), so a pile with no room on the farm still pays a
  little. At the festival's 1 point per 3 coins that is worth a third of a point a tile.
- **Compost a square** (not in the kit) is a Tend action: the bed, if any, and its tile go on the
  compost pile as one scrap each, and the square becomes empty ground for a new tile. It frees a
  square whose species is out of season for the rest of the year, like Wine Cap after summer.
- **Rain** advances growing beds twice (a slow bed's waiting phase counts as one step).
- **Blighted beds** can't be harvested or crossed.
- **Spreader targets** are picked with the seeded RNG when several squares qualify.
- **Score** is the kit's: delivered orders + 3 per hybrid kind made + 1 per species you planted.

## Foraging: the forest floor

The kit's foraging is a blind push-your-luck draw. On a phone that is one tap repeated, so the app
keeps the deck and the kit's rules but adds a small deduction game on top:

- Entering a zone deals a 3×3 patch of face-down cards from the top of that zone's deck
  (`rules.patchSize`).
- Tap a card to turn it. It resolves exactly like a kit draw: specimen to the basket, find to you,
  hazard to the meter. A turned non-hazard card shows how many hazards lie orthogonally beside it.
- The kit's limits are unchanged: a second hazard busts the trip and you keep your first two
  specimens, the Knife ignores the first hazard, the basket caps what you carry, and you can head
  home at any time.
- Swipe the deck up (at the bottom of the screen, by your thumb) to go deeper: unturned cards go
  back under the deck and a fresh patch deals upward. Hazards you've met carry over, so going
  deeper is the push-your-luck choice.
- Unturned cards always return under the deck, so each deck keeps its printed mix across the year.
  When a trip ends, the cards you passed are shown faded.

The numbers give the player real information without making a patch solvable at a glance: the
first card is always a blind pick, and later picks are informed guesses. The baseline bot reads
the numbers too; its bust rate fell from 8% to 5% of trips.

## The compost pile

Specimens you compost, fruit that goes overripe unpicked, and stock that spoils when the season
turns all go on a compost pile. Overnight, every 3 scraps (`rules.scrapsPerCompost`) rot into a
Compost tile in the shed, which Puffball grows on. Spoilage lands on the pile before it rots, so a
season's lost stock becomes compost the same night. Lookalikes still become a Compost tile
directly, as in the kit.

Why 3: even a player who never composts anything by hand puts about 8 scraps a year on the pile
from overripe fruit and spoiled stock (baseline bot, 300 years). At 2 per tile that made 3.7 tiles a
year, more than lookalikes (2.3); at 3 it makes 2.4, on par with lookalikes; at 4 it drops to 1.6,
about one a season. The festival's playtest log shows scraps and tiles for each year to check this
against human play.

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
| 6 | Steward | 150 | Farmhand: 5 actions a month |
| 7 | Elder of the Wood | 210 | 3rd heirloom slot |

Year one matches the paper-prototype plan (Meadow, Mixed Woods, the basic kit), and the content
expands from there, which is also how new biomes can slot in later. At a human score of about 20
a year, the last level arrives around year 9–10, roughly 7 hours of play.

**Heirlooms.** Before a story year starts you pack gear you've bought in earlier years, up to your
slots, and own it from month one. This is the spec's "permanent gear unlocks" with a choice attached,
so the first months of each year still differ.

**Species mastery.** Real identifications of a species accumulate across years. Familiar (3):
lookalikes fool you on one fewer number, so a cultivated species can no longer fail. Expert (8):
you know it on sight: it comes home already identified, with no lookalike risk, and wild finds go
straight to storage. Master (16): it
sells for a coin more. Mastery is the reward for the discovery pillar: the more you forage a
species, the more the forest gives you.

**Daily years** use the standard kit (every gear stocked, 4×4 farm, no heirlooms or mastery) so
everyone plays the same game, but they still earn renown and count toward mastery.

The farmhand targets the action economy on purpose, because actions are the tightest constraint
in the kit's numbers. (Expert used to save an Identify action too; since Identify now covers the
whole basket, its value is the certainty, not the action.)

`npm run sim -- 100 campaign` plays ten-year campaigns. The baseline bot climbs about one level
every 2–3 years, but its score stays flat (median 8–10) because it barely uses orders: it delivers
about half an order a year, so its points come from planting. So the sim checks the plumbing and
the renown pacing for a weak player. Whether the perks feel like a lift needs human playtests.

## Modes

- **Story year**: a random seed.
- **Daily year**: the seed is the date, so everyone gets the same weather and deck order that day.
  This is a cheap first step toward the spec's daily forage puzzle.

## Pacing: first numbers

`npm run sim` plays seeded years with a deliberately simple greedy bot. With the kit's values
(first build, one specimen per Identify, blind draws):

- Mean score about 9; roughly 1 in 10 years reaches Bronze (15+), none reach Silver.
- Tending takes about 0.7 of 4 actions a month, under the kit's "more than 1 of 3" warning line.
- Bust rate about 8% of trips (5% once the forest floor's numbers arrived).

The bot is a floor, not a skill estimate: it never plans for orders or hybrids. Even so, the
gap suggested the economy was tight: each specimen cost three actions (forage share, identify,
plant). **Identify now covers the whole basket for one action** (a departure from the kit's one
specimen per action). With that change the same bot averages 13.1 (from 9.1), reaches Bronze in
35% of years (from 11%) and Silver in 3%, and takes 10.7 forage trips a year (from 7.9). Further
levers, all in `src/data`: lower the tier thresholds, or let Market not cost an action. Treat the
human paper-prototype log as the real signal; the tabletop rules would need the same change to
stay in step with the app.

**Leftover coins now score**: 1 festival point per 3 coins left at the end (`coinsPerPoint` in
`rules.json`, rounded down). The bot ends a year holding about 15 coins (median 13, p90 31), so
1:1 would have doubled scores and made selling worth more than orders. At 1:3 the same bot averages
17.8 (from 13.1), reaches Bronze in 48% of years and Silver in 15% (from 35% and 3%). Over a
ten-year campaign its median climbs from about 20 to 24 instead of staying flat, because it hoards
coins and higher levels start it with more. Coins still spent on gear give up points, so buying
late in the year is now a real choice.

## Not in this build

Monetization and store builds (a natural demo cut is year one, levels 1–2), async co-op, expansion biomes, Riverbank/Waders, Burn Bed,
endless homestead mode. The spec's engine ("Court's stack") isn't available here; the rules
core is plain TypeScript with no DOM, so it can be ported or embedded.
