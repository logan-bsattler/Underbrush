import { content, score } from '../core';
import { Icon, Mushroom, Unknown } from './art';
import type { Store } from './store';
import { dailySeed } from './store';
import { growthName, seasonsText, substrateName } from './text';

export function Title({
  store,
  onStart,
  onContinue,
  onJournal,
  onHelp,
}: {
  store: Store;
  onStart: (mode: 'story' | 'daily') => void;
  onContinue: () => void;
  onJournal: () => void;
  onHelp: () => void;
}) {
  const save = store.game;
  const dailyPlayed = store.journal.years.some((y) => y.seed === dailySeed());
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
        {save && !save.over && (
          <button class="btn primary big" onClick={onContinue}>
            Continue · week {save.round}
          </button>
        )}
        <button class={`btn big ${save && !save.over ? '' : 'primary'}`} onClick={() => onStart('story')}>
          New year
        </button>
        <button class="btn big" onClick={() => onStart('daily')}>
          Daily year {dailyPlayed ? '· played' : ''}
          <small>Same weather and decks for everyone today</small>
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
              <div class="plate-kind">{sp.kind === 'wild' ? 'Wild only' : sp.kind === 'hybrid' ? 'Hybrid' : 'Cultivated'}</div>
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
          {r.rounds} weeks, {r.roundsPerSeason} per season. Each week a weather card turns, you take{' '}
          {r.actionsPerRound} actions, then you sleep and the farm grows on its own. At year's end the village Harvest Festival scores your
          delivered orders, +{r.hybridPoints} for every kind of hybrid you made and +{r.plantedPoints} for every species you planted.
        </p>
      </section>
      <section>
        <h2>Actions · 1 each</h2>
        <ul>
          <li>
            <b>Forage.</b> Pick a zone and draw cards one at a time. Stop whenever you like. A second hazard busts the trip and you keep only
            your first {r.bustKeep} specimens.
          </li>
          <li>
            <b>Identify</b> a specimen from your basket. A lookalike becomes a Compost tile; wild finds go straight to storage.
          </li>
          <li>
            <b>Plant</b> an identified specimen on an empty square of its substrate. It starts at Spawn.
          </li>
          <li>
            <b>Tend:</b> water every bed (no dry marks tonight), or clear blight from one bed.
          </li>
          <li>
            <b>Harvest</b> every fruiting bed into storage.
          </li>
          <li>
            <b>Market:</b> sell, deliver one festival order and buy gear, as much as you like in one visit.
          </li>
        </ul>
        <p class="small muted">Free any time: lay substrate from your shed on empty ground, and drop specimens you don't want.</p>
      </section>
      <section>
        <h2>Overnight</h2>
        <ol>
          <li>
            <b>Dry.</b> Unless you watered or it rained, beds away from the stream take a dry mark. {r.dryMarksToBlight} marks: blight.
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
            <b>Overripe.</b> Fruit left unpicked for a week drops back to Colonized.
          </li>
          <li>
            <b>Spreaders</b> (Oyster, Wine Cap) colonize an empty neighbor of their substrate when they fruit.
          </li>
          <li>
            <b>Hybrids.</b> Two compatible species side by side, both colonized, can cross. You choose which bed changes.
          </li>
        </ol>
        <p>
          If {r.moldBloomAt}+ beds are blighted, a mold bloom costs you an action next week. Stored mushrooms spoil when the season turns unless you
          own a Dehydrator.
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
