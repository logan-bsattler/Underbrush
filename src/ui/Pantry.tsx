import { basketCapacity, canCook, content, type GameState } from '../core';
import { Icon, Mushroom } from './art';
import { SheetFrame } from './Game';
import type { Store } from './store';
import { name, substrateName } from './text';

/**
 * What's in storage, and what else it can be besides coins: cook one dish a month for its effect,
 * or take a grown mushroom back out as spawn to plant again.
 */
export function Pantry({ g, store, onClose }: { g: GameState; store: Store; onClose: () => void }) {
  const stored = content.speciesOrder.filter((id) => (g.storage[id] ?? 0) > 0);
  const meal = g.meal ? content.recipes.find((r) => r.id === g.meal) : null;
  const roomInBasket = g.basket.length < basketCapacity(g);
  const lastMonth = g.round % content.rules.roundsPerSeason === 0 && g.round < content.rules.rounds;
  const busy = !!g.finale;

  return (
    <SheetFrame title="Pantry" onClose={onClose} tall>
      <p class="small muted">
        Mushrooms you've harvested or found. Sell them at the market, or use them here: cook one dish a month, or save a grown mushroom as
        spawn to plant again. Both are free.
      </p>
      {lastMonth && !g.gear.includes('dehydrator') && stored.length > 0 && (
        <p class="note warn">Last month of the season: anything still in storage spoils tonight.</p>
      )}

      <h3>In storage</h3>
      {stored.length === 0 ? (
        <p class="muted">Nothing stored yet. Harvest fruiting beds, or identify wild finds.</p>
      ) : (
        <ul class="storage">
          {stored.map((id) => {
            const sp = content.species[id];
            const growable = sp.kind !== 'wild';
            return (
              <li>
                <Mushroom species={id} size={40} />
                <span class="grow">
                  <b>{name(id)}</b> × {g.storage[id]}
                  <small class="muted"> · {growable ? `grows on ${sp.substrates.map((x) => substrateName[x]).join(' or ')}` : 'wild'}</small>
                </span>
                {growable && (
                  <button
                    class="btn small"
                    disabled={!roomInBasket || busy}
                    onClick={() => store.act({ type: 'saveSpawn', species: id })}
                    aria-label={`Save one ${name(id)} as spawn: it goes to your basket, ready to plant`}
                  >
                    Save as spawn
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {stored.some((id) => content.species[id].kind !== 'wild') && (
        <p class="small muted">{roomInBasket ? 'Spawn goes into your basket, already identified. Planting it takes an action as usual.' : 'Your basket is full.'}</p>
      )}

      <h3>
        <Icon name="bowl" size={18} /> Cook
      </h3>
      {meal ? (
        <p class="note">
          <b>{meal.name}</b> this month. {meal.rule}
        </p>
      ) : (
        <p class="small muted">One dish a month. Its effect lasts until you end the month.</p>
      )}
      <div class="recipes">
        {content.recipes.map((r) => {
          const ready = canCook(g, r);
          const needs = Object.entries(r.needs);
          return (
            <div class={`recipe ${ready ? 'ready' : ''} ${g.meal === r.id ? 'eaten' : ''}`}>
              <div class="recipe-art" aria-hidden="true">
                {needs.map(([id]) => (g.storage[id] || g.discovered.includes(id) || store.journal.discovered.includes(id) ? <Mushroom species={id} size={34} /> : <span class="q">?</span>))}
              </div>
              <div class="grow">
                <b>{r.name}</b>
                <div class="small muted">
                  {needs.map(([id, n]) => `${n} ${content.species[id].name} (${g.storage[id] ?? 0})`).join(' + ')}
                </div>
                <div class="small">{r.rule}</div>
              </div>
              <button class="btn small primary" disabled={!ready || !!g.meal || busy} onClick={() => store.act({ type: 'cook', recipe: r.id })}>
                Cook
              </button>
            </div>
          );
        })}
      </div>
      <button class="btn wide" onClick={onClose}>
        Close
      </button>
    </SheetFrame>
  );
}
