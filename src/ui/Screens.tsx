import { content, dailyBoard, masteryLevel, score } from '../core';
import { Icon, Mushroom, Unknown } from './art';
import { HomesteadCard } from './Progress';
import type { Store } from './store';
import { dailySeed } from './store';
import { growthName, masteryName, seasonsText, substrateName } from './text';

export function Title({
  store,
  onStart,
  onContinue,
  onJournal,
  onAlmanac,
  onHelp,
}: {
  store: Store;
  onStart: (mode: 'story' | 'daily') => void;
  onContinue: () => void;
  onJournal: () => void;
  onAlmanac: () => void;
  onHelp: () => void;
}) {
  const save = store.game;
  const today = store.journal.years.find((y) => y.seed === dailySeed());
  const todayBoard = content.boards.find((b) => b.id === dailyBoard(dailySeed()))?.name;
  return (
    <div class="screen title">
      <div class="title-art" aria-hidden="true">
        <span class="t1">
          <Mushroom species="chanterelle" size={110} />
        </span>
        <span class="t2">
          <Mushroom species="oyster" size={130} />
        </span>
        <span class="t3">
          <Mushroom species="winecap" size={96} />
        </span>
      </div>
      <h1 class="logo">Underbrush</h1>
      <p class="tagline">Forage the woods. Cultivate a homestead. Fill the festival orders by year's end.</p>
      <div class="col menu">
        <HomesteadCard journal={store.journal} onAlmanac={onAlmanac} />
        {save && !save.over && (
          <button class="btn primary big" onClick={onContinue}>
            Continue · {save.finale ? 'festival morning' : `month ${save.round}`}
          </button>
        )}
        <button class={`btn big ${save && !save.over ? '' : 'primary'}`} onClick={() => onStart('story')}>
          {save && !save.over ? 'Start over with a new year' : 'New year'}
          <small>Your homestead's unlocks and heirlooms come with you</small>
        </button>
        <button class="btn big" onClick={() => onStart('daily')}>
          Daily year {today ? `· played, ${today.score} points` : ''}
          <small>Everyone gets today's farm ({todayBoard}), weather and decks, with the standard kit</small>
        </button>
        <div class="row">
          <button class="btn grow" onClick={onJournal}>
            <Icon name="book" /> Field journal
          </button>
          <button class="btn grow" onClick={onHelp}>
            How to play
          </button>
        </div>
      </div>
      <p class="disclaimer">Underbrush is a game, not a foraging guide. Never eat a wild mushroom because of anything you saw here.</p>
    </div>
  );
}

export function Journal({ store, onBack }: { store: Store; onBack: () => void }) {
  const j = store.journal;
  const ids = content.speciesOrder;
  const found = ids.filter((id) => j.discovered.includes(id)).length;
  const best = j.years.reduce<{ score: number; tier: string | null } | null>((b, y) => (!b || y.score > b.score ? y : b), null);
  const live = store.game ? score(store.game).total : null;
  return (
    <div class="screen journal paper">
      <header class="screen-head">
        <button class="btn small ghost" onClick={onBack}>
          ← Back
        </button>
        <h1>Field journal</h1>
      </header>
      <p class="muted">
        {found} of {ids.length} entries · {j.years.length} year{j.years.length === 1 ? '' : 's'} at the festival
        {best ? ` · best ${best.score}${best.tier ? ` (${content.rules.tiers.find((t) => t.id === best.tier)?.name})` : ''}` : ''}
        {live !== null && store.game && !store.game.over ? ` · this year so far ${live}` : ''}
      </p>
      <div class="plates">
        {ids.map((id) => {
          const sp = content.species[id];
          const known = j.discovered.includes(id);
          return (
            <article class={`plate-card ${known ? '' : 'unknown'} ${sp.kind}`}>
              <div class="plate-art">{known ? <Mushroom species={id} size={84} /> : sp.kind === 'hybrid' ? <span class="q">?</span> : <Unknown species={id} size={84} />}</div>
              <div class="plate-kind">
                {sp.kind === 'wild' ? 'Wild only' : sp.kind === 'hybrid' ? 'Hybrid' : 'Cultivated'}
                {masteryLevel(j.idCounts[id] ?? 0) > 0 && (
                  <span class={`mastery-tag m${masteryLevel(j.idCounts[id] ?? 0)}`}>{masteryName(masteryLevel(j.idCounts[id] ?? 0))}</span>
                )}
              </div>
              <h3>{known ? sp.name : sp.kind === 'hybrid' ? 'Unknown hybrid' : sp.group}</h3>
              {known ? (
                <>
                  {sp.latin && <div class="latin">{sp.latin}</div>}
                  <p>{sp.blurb}</p>
                  <dl class="meta tiny">
                    <dt>Substrate</dt>
                    <dd>{sp.substrates.length ? sp.substrates.map((x) => substrateName[x]).join(' or ') : 'None'}</dd>
                    <dt>Season</dt>
                    <dd>{seasonsText(id)}</dd>
                    <dt>Growth</dt>
                    <dd>{growthName[sp.growth]}</dd>
                    <dt>Value</dt>
                    <dd>{sp.value}</dd>
                    {sp.lookalike && (
                      <>
                        <dt>Lookalike</dt>
                        <dd>
                          {sp.lookalike.name}
                          {j.lookalikes.includes(id) ? ' (met)' : ''}
                        </dd>
                      </>
                    )}
                    {sp.parents && (
                      <>
                        <dt>Parents</dt>
                        <dd>{sp.parents.map((p) => content.species[p].name).join(' × ')}</dd>
                      </>
                    )}
                  </dl>
                </>
              ) : (
                <p class="muted small">{sp.kind === 'hybrid' ? 'Grow two compatible species side by side to discover it.' : 'Identify one to fill in this page.'}</p>
              )}
            </article>
          );
        })}
      </div>
      <p class="disclaimer">Real names, seasons and lookalikes, compressed for play. This journal is not a foraging guide.</p>
    </div>
  );
}

export function HowTo({ onBack }: { onBack: () => void }) {
  const r = content.rules;
  return (
    <div class="screen howto paper">
      <header class="screen-head">
        <button class="btn small ghost" onClick={onBack}>
          ← Back
        </button>
        <h1>How to play</h1>
      </header>
      <section>
        <h2>The year</h2>
        <p>
          {r.rounds} months, {r.roundsPerSeason} per season. Each month a weather card turns, you take{' '}
          {r.actionsPerRound} actions, then you sleep and the farm grows on its own. After the last night you get a festival morning: one last harvest and one
          market visit, free of actions. Then the village Harvest Festival scores your
          delivered orders, +{r.hybridPoints} for every kind of hybrid you made, +{r.plantedPoints} for every species you planted and +1 for
          every {r.coinsPerPoint} coins you have left.
        </p>
      </section>
      <section>
        <h2>Actions · 1 each</h2>
        <ul>
          <li>
            <b>Forage.</b> Pick a zone and a {r.patchSize}×{r.patchSize} patch of forest floor is dealt face down from its deck. Turn cards one
            at a time: each turned card shows how many hazards lie beside it (up, down, left, right). Swipe the deck up to go deeper into a
            fresh patch; unturned cards stay behind. Each trip is one pass through the zone's deck, so going deeper ends where the deck
            runs out; the next trip starts with the whole deck again. From the {r.deepAt === 3 ? 'third' : `${r.deepAt}th`} patch in, every patch
            hides one rare find among its face-down cards: the zone's rare mushroom for the season, or now and then a forager's cache of coins. It looks like any other card until you turn it. Head home whenever you like. A
            second hazard busts the trip and you keep only your first {r.bustKeep} specimens.
          </li>
          <li>
            <b>Identify</b> everything unknown in your basket at once. A lookalike becomes a Compost tile; wild finds go straight to storage.
          </li>
          <li>
            <b>Plant</b> an identified specimen on an empty square of its substrate. It starts at Spawn.
          </li>
          <li>
            <b>Tend:</b> water every bed (no dry marks tonight), clear blight from one bed, move your grow tent to another square, or compost a square: its bed and tile go on the
            compost pile, leaving empty ground for a new tile. Handy when a bed's season is over.
          </li>
          <li>
            <b>Harvest</b> every fruiting bed into storage.
          </li>
          <li>
            <b>Market:</b> sell mushrooms and spare Compost tiles, deliver one festival order, buy gear and spawn, as much as you like in one
            visit. The visit lasts until you spend another action, so you can close the market and come back. Spawn of any cultivated species you've identified is ready to plant. Swap an order you can't fill for the next one for{' '}
            {r.swapCost} coins, a coin more for each swap that year.
          </li>
        </ul>
        <p class="small muted">Free any time: lay substrate from your shed on empty ground, and compost specimens you don't want (one at a time, or the whole basket with Compost all). Composted specimens, overripe fruit and spoiled stock all go on the compost pile, and every{' '}
          {r.scrapsPerCompost} scraps rot into a Compost tile overnight.</p>
        <p class="small muted">
          Also free, in the pantry: cook one dish a month from stored mushrooms (Reishi Tea is an extra action, Oyster Fry a bigger basket,
          and so on), or save a grown mushroom as spawn to plant again. Hybrids can be replanted this way too.
        </p>
      </section>
      <section>
        <h2>Overnight</h2>
        <ol>
          <li>
            <b>Dry.</b> Unless you watered or it rained, beds away from the stream or a spring take a dry mark. {r.dryMarksToBlight} marks: blight.
          </li>
          <li>
            <b>Crowding.</b> A bed touching {r.crowdingAt}+ beds of its own species catches blight.
          </li>
          <li>
            <b>Blight spreads</b> to neighbors of the same species.
          </li>
          <li>
            <b>Grow.</b> In-season, unblighted beds advance: Spawn → Colonized → Pinning → Fruiting. Fast species skip Pinning; slow ones linger.
            Growing clears dry marks.
          </li>
          <li>
            <b>Overripe.</b> Fruit left unpicked for a month drops back to Colonized.
          </li>
          <li>
            <b>Spreaders</b> (Oyster, Wine Cap) colonize an empty neighbor of their substrate when they fruit.
          </li>
          <li>
            <b>Hybrids.</b> Two compatible species side by side, both colonized, can cross. You choose which bed changes.
          </li>
        </ol>
        <p>
          If {r.moldBloomAt}+ beds are blighted, a mold bloom costs you an action next month. Stored mushrooms spoil when the season turns unless you
          own a Dehydrator.
        </p>
      </section>
      <section>
        <h2>Your homestead</h2>
        <p>
          Every festival score becomes renown, and renown raises your homestead's level. Levels stock new gear (the Lantern and Trail Map
          open new zones), give you heirloom slots for carrying gear into the next year, grow the farm to 5×5, bring in a farmhand for a fifth
          monthly action, open new farms to start the year on, and at the top, the Hollow and an apprentice who picks ripe beds every
          morning.
        </p>
        <p>
          Identifying the same species again and again builds mastery: Familiar species fool you less often, you recognize Expert species on
          sight, and Master species sell for more. Daily years use the standard kit on the day's farm, so everyone plays the same game, but
          still earn renown. Share your result from the festival screen.
        </p>
      </section>
      <section>
        <h2>Tiers</h2>
        <p>{r.tiers.map((t) => `${t.name} ${t.min}+`).join(' · ')}</p>
      </section>
      <p class="disclaimer">Underbrush is a game, not a foraging guide. Never eat a wild mushroom because of anything you saw here.</p>
    </div>
  );
}
