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
and one market visit (sell, deliver orders), neither costing an action, so fruit that ripens on
the last night still counts. Nothing else is possible that morning, the shop sells no gear, and a
hybrid offered on the last night can still be made before the festival scores the year.

Interpretations where the kit left room:

- **Dry marks** are erased when a bed grows (kit wording), so they mainly build up on beds that
  are out of season, unshaded, blighted, or sitting at Fruiting.
- **Market** costs 1 action per visit, charged on the first trade, so opening the sheet to look is free.
  The visit lasts until you next spend an action, so closing the sheet and coming back to trade
  (to lay a tile, say, or cook) is still the same visit.
- **Substrate finds and compost** go to a shed; laying a tile on empty ground is free.
- **Selling compost** (not in the kit): Compost tiles in the shed sell at the market for 1 coin
  each (`rules.compostValue`, +1 on Market day), so a pile with no room on the farm still pays a
  little. At the festival's 1 point per 5 coins that is worth a fifth of a point a tile.
- **Compost a square** (not in the kit) is a Tend action: the bed, if any, and its tile go on the
  compost pile as one scrap each, and the square becomes empty ground for a new tile. It frees a
  square whose species is out of season for the rest of the year, like Wine Cap after summer.
- **Moving the Grow Tent** (not in the kit) is a Tend action. Pitching it the first time is free;
  after that it can follow the bed that needs it, such as a fall crop carried into winter. A
  second tent was considered and left out: two tents take too much of a small farm out of the
  season windows, and the frustration it would answer was the tent being stuck where it was first pitched.
- **Damp squares** (the stream column, or a board's springs) never take dry marks.
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
- **A full basket makes room for better finds** (not the kit's): a wild specimen bumps out a
  cultivated one, and a rare find (a deep find) bumps out anything that isn't rare, taking the
  lowest-ranked and then the cheapest. The bumped specimen stays on the forest floor and no longer
  counts as picked this trip. Cultivated finds and ties are still left behind. An Expert's wild
  find goes straight to storage, so a full basket never costs it.
- Swipe the deck up (at the bottom of the screen, by your thumb) to go deeper: unturned cards stay
  behind and a fresh patch deals upward. Hazards you've met carry over, so going deeper is the
  push-your-luck choice.
- A trip is one pass through the zone's deck, with no reshuffle: a 32-card deck deals patches of
  9 and 9, then 8 and its last 6 (each with a deep find), and then the deck reads "End of the zone".
  When the trip ends, every card goes back and the deck is shuffled, so each trip walks the whole
  printed deck, and the deck shows how many cards are left. When a trip ends, the cards you passed
  are shown faded.
- **Plain ground.** About 40% of every zone deck is plain forest floor (`ground`): bare earth,
  brush or a tree in the zone's own names (Tall Grass, Leaf Litter, Fireweed...), 13 of 32 cards.
  They replaced mushroom, substrate and coin cards; hazards kept their counts, so each turn risks as
  much for less, and a turned plain card's number is often all it gives. Each zone kept every
  species it had, at roughly its old proportions (Meadow dropped its one Compost card, Mixed Woods
  and Burn Scar their coins).
- **Deck size** (not the kit's): every zone has 32 cards, up from the kit's 24, so a single pass
  reaches two deep patches instead of one. The decks are the kit's scaled by 4/3, keeping each
  zone's share of specimens, substrate, coins and hazards; Mixed Woods trades a Chanterelle for a
  third Enoki so each plantable species has three copies. Holding substrate at the kit's counts
  instead cost the baseline bot about 1.3 points a year (fewer beds, fewer orders); scaled, it
  scores the same as on the 24-card decks (15.4 over 2,000 years).

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
| 1 | Newcomer | 0 | Meadow and Mixed Woods; shop stocks Bigger Basket, Field Guide, Knife, Dehydrator; Streamside and Meadow Edge farms |
| 2 | Gatherer | 15 | 1 heirloom slot; Grow Tent |
| 3 | Forager | 40 | Lantern (opens Old-growth); Blight Spray |
| 4 | Grower | 70 | Farm grows to 5×5 (one more tree); +2 starting coins; Drip Line |
| 5 | Mycophile | 105 | 2nd heirloom slot; Trail Map (opens Burn Scar) |
| 6 | Steward | 150 | Farmhand: 5 actions a month; the Woodlot farm |
| 7 | Elder of the Wood | 210 | 3rd heirloom slot |
| 8 | Pathfinder | 280 | Compass (opens the Hollow) |
| 9 | Lorekeeper | 370 | Auto harvest: fruiting beds are picked into storage each morning |
| 10 | Legend of the Valley | 480 | 4th heirloom slot; the Old Orchard farm |

Year one matches the paper-prototype plan (Meadow, Mixed Woods, the basic kit), and the content
expands from there, which is also how new biomes can slot in later. At a human score of about 20
a year, level 7 arrives around year 9–10, roughly 7 hours of play. Levels 8–10 were added after a
playtester reached level 7 and found nothing left to work toward; at the 40–50 a year a practiced
player scores, they take another five or six years.

**Heirlooms.** Before a story year starts you pack gear you've bought in earlier years, up to your
slots, and own it from month one. This is the spec's "permanent gear unlocks" with a choice attached,
so the first months of each year still differ.

**Species mastery.** Real identifications of a species accumulate across years. Familiar (3):
lookalikes fool you on one fewer number, so a cultivated species can no longer fail. Expert (8):
you know it on sight: it comes home already identified, with no lookalike risk, and wild finds go
straight to storage. Master (16): it
sells for a coin more. Mastery is the reward for the discovery pillar: the more you forage a
species, the more the forest gives you.

**Daily years** use the standard kit (every gear stocked, 4×4 farm, no heirlooms, mastery or auto harvest) so
everyone plays the same game, but they still earn renown and count toward mastery.

The farmhand targets the action economy on purpose, because actions are the tightest constraint
in the kit's numbers. (Expert used to save an Identify action too; since Identify now covers the
whole basket, its value is the certainty, not the action.)

`npm run sim -- 100 campaign` plays ten-year campaigns. The baseline bot climbs about one level
every 2–3 years, but its score stays flat (median 8–10) because it barely uses orders: it delivers
about half an order a year, so its points come from planting. So the sim checks the plumbing and
the renown pacing for a weak player. Whether the perks feel like a lift needs human playtests.

## Added after the first playtests

A round of playtest notes asked for more to do with mushrooms and coins, an easier time growing
the valuable species, and something to aim for after level 7. All of it is data in `src/data`.

- **Gentler valuable species.** Reishi needed seven in-season phases in a three-month season, so
  it could only fruit under the tent. It now grows summer and fall at Slow (four phases). Shiitake
  is Medium instead of Slow, Lion's Mane grows summer and fall, and Enoki fall and winter.
- **Spawn at the market.** Spawn of any cultivated species you've identified (this year, or ever,
  in the field journal) costs its value + 2 coins (`rules.spawnMarkup`) and arrives identified in
  your basket. It's a coin sink and a way to start a Reishi or Shiitake log on purpose.
- **The pantry.** Stored mushrooms have uses besides selling. Cook one dish a month, free, from
  `recipes.json` (Reishi Tea: +1 action; Oyster Fry: +2 basket; Lion's Mane Broth: better
  identification; Chanterelle Toast: bust on the third hazard; Wine Cap Risotto: +1 coin a sale;
  Puffball Supper: the beds are watered; Truffle Shavings: 3 festival points). Or save a stored
  cultivated or hybrid mushroom as spawn to replant, which is also the only way to plant a hybrid
  somewhere new.
- **Swapping orders.** At the market, swap a festival order for the next one for 2 coins, a coin
  more for each swap that year (`rules.swapCost`). A human playtest ended with 171 leftover coins;
  swaps and spawn give them somewhere to go besides the festival's coin points, which stop at 10. Orders that need a
  zone the shop can't open (`requires` in `orders.json`) aren't dealt.
- **More ways to spend coins.** Once leftover coins stopped scoring past 10 points, a playtester
  still had coins with nowhere to go, so the market has three more uses for them, all in `rules.json`:
  - *Hire a hand* (`hireCost` 5, `hireStep` 2): +1 action this month for 5, 7, 9… coins, one a
    month. It needs no market visit, so it is a straight trade of coins for the tightest
    resource in the game; the rising price keeps it from replacing the Farmhand level.
  - *Extra deliveries* (`extraDeliveryCost` 4): the first order on a visit is free as before, and
    each further one that visit costs 4 coins. The one-order limit throttled the part of the score
    meant to carry a year, most of all on festival morning with a full storage.
    *Then doubling* (`extraDeliveryGrowth` 2): a level-10 playtest year scored 99 (78 from 13
    orders) with 444 coins earned, so a flat 4 coins was no brake at all. Extra deliveries on one
    visit now cost 4, 8, 16… The baseline bot rarely makes them, so it scores the same (15.6 over
    300 years); the playtest log is the signal to watch.
  - *A substrate stall* (`substrateCost`): Straw, Woodchip and Compost tiles for 2 coins, Logs for
    3, into the shed. Beds no longer wait on the forest dealing the right substrate.
- **Going deeper.** From the third patch of a trip (`rules.deepAt`), every patch holds one
  deep find, dealt from the zone's `deep` list and never part of its deck: the zone's
  rare mushroom for the season, or, one time in four (`rules.deepCoinChance`), a cache of coins.
  Every zone has exactly one rare mushroom for each season it's open:

  | Zone | Spring | Summer | Fall | Winter |
  | --- | --- | --- | --- | --- |
  | Meadow | St. George's Mushroom | Fairy Ring Champignon | Blewit | Blewit |
  | Mixed Woods | Morel | Chicken of the Woods | Hen of the Woods | Wood Ear |
  | Old-growth | Spring King Bolete | Black Trumpet | Black Trumpet | Yellowfoot |
  | Burn Scar | Black Morel | | | |
  | The Hollow | | | Matsutake | Truffle |
  | Riverbank | Half-free Morel | Lobster Mushroom | Cauliflower Mushroom | |

  Eight of them (St. George's, Fairy Ring, Chicken of the Woods, Wood Ear, Spring King, Yellowfoot,
  Black Morel, Matsutake) are wild species found only this way, valued 4 to 7 like the other wild
  finds. Before them, a zone with nothing in season always dealt coins, so most deep finds were
  coins. The zone picker shows the rare find in season now.

  Face down, the deep find looks like any other card; the message only says one card on the patch
  hides it. (When it glinted, going deeper was free and the glint marked the card, so a trip could
  swipe to each deep patch and take its rare find with no risk.) Turned over, it bursts with gold
  light, keeps a gold glow and a Rare tag, and the message reads "Rare find!". When a trip ends,
  a rare find you walked past shows with the other faded cards.
- **The Hollow** (Compass, 7 coins, level 8; fall and winter): Blewit, Truffle, Hen of the Woods
  and Black Trumpet, with 10 hazards in 32 cards. Truffle (value 7, winter) gives winter something
  to forage for.
- **The Riverbank** (Waders, 6 coins, level 7; spring to fall, closed when the banks ice over):
  Oyster and Enoki, two wild species found nowhere else, Dryad's Saddle (value 3, spring) and
  Shaggy Mane (value 4, summer and fall), driftwood logs and reed straw, with 8 hazards (Slick
  Rocks, High Water, Ticks) in 32 cards. Its rare finds, Half-free Morel (5), Lobster Mushroom (6)
  and Cauliflower Mushroom (6), are new wild species too. Level 7 had only a heirloom slot, so this
  gives it a reason to reach for. Two orders come with it, dealt only once the shop stocks Waders:
  2 Shaggy Mane (6 points) and 1 Dryad's Saddle + 2 Oyster (5). The baseline bot buys Waders after
  the Drip Line; on the standard kit it averages 14.8 over 500 years (from 15.5), since the coins
  and trips it spends there would have scored elsewhere. Its ten-year campaigns don't change,
  because it never reaches level 7 in ten years.
- **Gear.** Drip Line (7 coins, level 4) waters every bed each night and keeps dry spells from
  stalling. Blight Spray (5 coins, level 3) makes Clear blight treat every blighted bed at once.
- **Auto harvest** (level 9) picks every fruiting bed into storage each morning, after the season's
  spoilage, so a fresh harvest makes it into the new season.
- **Starting boards** (`boards.json`): Streamside (the kit's layout), Meadow Edge (one tree, a Wine
  Cap patch), Woodlot (three trees, a Shiitake log, no stream but a spring) and Old Orchard (Reishi
  and Shiitake logs side by side, a Lacquer Cap waiting to happen). Story years choose one when they
  set out; daily years get one from the date. A 5×5 farm extends a board right and down.
- **Seasons on the farm.** Grass, trees, soil and the page shift with the season, with a few
  petals, leaves or snowflakes drifting behind (none with reduced motion).
- **Sharing a daily year.** The festival screen copies (or opens the share sheet with) a short
  card: day, tier, score, board, the score lines and an emoji picture of the farm.

The baseline bot buys the new gear but doesn't cook, swap or buy spawn; over 300 years it averages
16.2 (from 16.0), with the same tier spread. The new levers are for people, so the playtest log is
still the signal to watch, especially leftover coins.

## Modes

- **Story year**: a random seed.
- **Daily year**: the seed is the date, so everyone gets the same farm, weather and deck order that
  day, and the festival screen shares the result. A leaderboard would need a server; this is still a
  static site, so that's left for later.

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

**Then raised to 1 point per 5 coins.** A human playtest reached Golden Chanterelle (45) with 28
points from 84 leftover coins and only 4 from orders: once species reach Master (+1 coin a sale)
and a 5×5 farm, selling everything outscores chasing orders. At 1:5 that year scores 39 (Gold).
The bot, which hoards far less than a person, averages 16.4 (from 18.7) over 500 years: Bronze
47%, Silver 9%, Gold 1%, and no tier 43% (from 29%). Its ten-year campaign median now goes from
about 17 to 18 rather than 20 to 24, so if later years feel flat in play, the next lever is the
tier thresholds or what higher levels unlock, not the coin rate.

**Then capped at 10 points** (`maxCoinPoints`). After the rare finds arrived, a human daily year
on the standard kit reached Golden Chanterelle (49) with 20 points from 104 leftover coins against
18 from three orders: deep finds sell for 4 to 7 coins each, so selling everything still kept pace
with orders. A rate change would hit weak players as hard as hoarders; a cap only touches the
hoard. The bot ends a year with a median of 19 coins (p90 36) and reaches 50 in 2% of years, so it
averages 15.5 (from 15.6) with the same tier spread, while that human year scores 39 (Gold). Coins
past 50 are now for spending: swaps to chase orders that fit the farm, and spawn.

## The end game

Two loops for a homestead that has earned every level, both in `progression.json`:

- **Pass it on** (`legacy`): a Legend of the Valley can hand the homestead down from the Almanac.
  Renown, levels and gear start over at level 1; the field journal, species mastery and
  achievements stay. Each generation raises every festival tier by 5 points (`tierStep`) and
  starts every year with 2 more coins (`startCoins`). The journal keeps the lineage.
- **Legend challenges** (`challenges`): at Legend, the pack screen offers handicaps for the year,
  stackable, each worth extra renown on the festival score: Short-handed (one fewer action a
  month, +25%), Lean Year (no starting coins or heirlooms, +15%), Thin Basket (one fewer basket
  slot, +15%). Challenges end when you pass the homestead on and return at the next Legend.

Daily years ignore both and stay on the standard kit.

## The underground

Foraging goes deeper each generation. Every zone has three layers below it in
`src/data/underground.json`; generation 1 reaches none, and each generation after opens one more
(`layersOpen`). Rules live in `src/core/underground.ts` and the `descend` action.

- **Getting down.** The way down is a face-down card (`entrance`), dealt from outside the deck
  into the zone's last patch, and into each layer's patch when a deeper layer is open. Turn it and
  the trip can descend (`descendStatus`); bust first, head home or swipe past it, and there's no
  descent this trip. The message says which patch hides it, never which card. Each layer is a
  single patch dealt from its own 12-card deck, with more hazards the deeper it is; the hazards met
  above still count. There's no going deeper in a layer, only down again or home. The deck swipes
  down once the way is turned.
- **Artifacts.** Each layer holds one artifact (`artifacts.json`, 18 in all), dealt into its patch
  until it's brought home that year. Turned, it's pocketed like a find, so a bust can cost it. It
  scores 2, 3 or 4 festival points by depth (`score().artifacts`) and goes into the journal's
  cabinet of curiosities for good.
- **Sets.** Six sets of three. A whole set in the cabinet adds a modest perk to every story year
  after, through `perksFor` (`perks.sets`): the Drover's Purse (+2 starting coins), the Forager's
  Lantern (rare finds and artifacts glint face down), the Festival Ribbons (+2 festival points,
  `score().family`), the Mapmaker's Case (the way down lies in the first deep patch, not the last), the Mushroom Stones (a bust
  keeps one more find) and the First Homestead (+1 basket).
- **Family lore.** Every layer has a clue in the family's voice ("Grandpa used to speak of...")
  and a payoff line. The zone picker shows the clue for the next layer down; the Almanac's Pass it
  on section tells the clue for a layer the generation just opened (`generationLore`, zones from
  `legacy.lore`); and the first time the family reaches a layer or completes a set, a Family lore
  banner pays it off. Unfound artifacts in the cabinet say which layer they lie in.

Daily years stay on the standard kit: generation 1, no layers, no set perks.

`npm run sim -- 300 gen` plays Legend years with every gear owned, the bot diving on every other
trip (a floor: it never chases sets or plans a descent):

| Generation | Bronze | Median | p90 | Tier reached | Artifacts/yr | Descents/yr | Bust rate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 15 | 18 | 32 | 76% | 0.0 | 0.0 | 1% |
| 2 | 20 | 32 | 43 | 96% | 2.6 | 12.6 | 2% |
| 3 | 25 | 38 | 51 | 98% | 5.1 | 22.4 | 6% |
| 4 | 30 | 46 | 58 | 98% | 6.9 | 30.9 | 16% |
| 4, full cabinet | 30 | 48 | 60 | 99% | 6.9 | 30.8 | 17% |

With plain ground and the way-down card, the diving bot now walks to the zone's last patch and
turns cards until it finds the way, picking up finds as it goes, and in later generations turns
each layer's patch for the next way down. That is why artifacts, descents and busts all climb with
the generation: generation 4 has three layers to search through. The tiers were left as they
were. On the standard kit the baseline bot fell from 15.0 to 11.9 a year (1,000 years), with
Bronze or better from 49% to 28%, since 13 of every zone's 32 cards now give nothing.

## Achievements

Feats the field journal remembers across every year, listed in the Almanac and announced with a
banner the moment they're earned. Each one is a check in `src/data/achievements.json` against what
the engine records about a year, so adding one is data plus, for a new kind of check, a case in
`src/core/achievements.ts`.

- **Nothing Left Unturned** (`clearZone`): turn every card in a zone's deck except its hazards on
  one trip. Going deeper with a non-hazard card still face down rules the trip out; rare finds
  don't count either way. The journal also keeps which zones you've cleared.

The rest, roughly in the order a homestead meets them. Everything counted is within one year:

| Achievement | Check | Feat |
| --- | --- | --- |
| First Ribbon | `tier` | Bronze or better at the festival |
| Cross-Pollinator | `hybrids` | Grow a hybrid |
| Into the Deep | `rareFinds` | Pick 5 rare mushrooms from deep finds (caches of coins don't count) |
| Sure-Footed | `cleanYear` | 10 or more forage trips and no bust |
| Village Cook | `dishes` | Cook 4 different dishes |
| Black Gold | `compost` | Rot 5 Compost tiles from the pile |
| Full Purse | `coinsEarned` | Earn 100 coins |
| Full Order Book | `orders` | Deliver 6 festival orders |
| Wall to Wall | `fullFarm` | Every square but the trees growing a mushroom at once |
| Strange Gardens | `hybrids` | Grow 3 different hybrids |
| Golden Chanterelle | `tier` | The festival's top tier |
| Family Farm | `generation` | Pass the homestead on (earned on the next generation's first action) |
| Against the Grain | `challenges` | Reach a tier with all three Legend challenges |

Tier checks only count once the festival is over and use that generation's raised thresholds.
The year's state now also counts rare finds and the different dishes cooked (`stats.rareFinds`,
`stats.dishes`). Over 300 standard-kit years the baseline bot earns First Ribbon in 50%,
Cross-Pollinator 76%, Sure-Footed 44%, Black Gold and Wall to Wall 8% each, Strange Gardens 1% and
nothing else. It never cooks, goes deep or plans for orders, so those are for people.

## Not in this build

Monetization and store builds (a natural demo cut is year one, levels 1–2), async co-op, expansion biomes, Burn Bed,
endless homestead mode. The spec's engine ("Court's stack") isn't available here; the rules
core is plain TypeScript with no DOM, so it can be ported or embedded.
