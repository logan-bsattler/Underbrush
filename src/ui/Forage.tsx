import { useRef, useState } from 'preact/hooks';
import {
  basketCapacity,
  bustAt,
  bustKeep,
  content,
  descendStatus,
  gearUnlockLevel,
  glints,
  hasSetEffect,
  hazardsNear,
  inSeason,
  layerDef,
  layersOpen,
  nextClue,
  seasonOf,
  zoneStatus,
  type Card,
  type DrawOutcome,
  type GameState,
} from '../core';
import { Icon, Mushroom, SubstrateArt, Unknown } from './art';
import { SheetFrame } from './Game';
import type { Store } from './store';
import { cardTitle, name, outcomeText } from './text';

function buzz(ms: number | number[]) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Not every browser allows vibration; it's only flavor.
  }
}

/** The face of a turned forest-floor card. */
function CardArt({ card, outcome }: { card: Card; outcome: DrawOutcome | null }) {
  if (card.type === 'specimen')
    return outcome === 'known' ? <Mushroom species={card.species} size={64} /> : <Unknown species={card.species} size={64} />;
  if (card.type === 'substrate') return <SubstrateArt substrate={card.substrate} size={64} />;
  if (card.type === 'ground') return <Icon name={card.look} size={44} />;
  return <Icon name={card.type === 'coins' ? 'coin' : card.type === 'artifact' ? 'relic' : card.type === 'entrance' ? 'way' : 'hazard'} size={44} />;
}

function cardLabel(card: Card, outcome: DrawOutcome | null) {
  return outcome === 'known' && card.type === 'specimen' ? name(card.species) : cardTitle(card);
}

function lockedText(unlock: string | null, st: { reason: string; notStocked?: boolean }) {
  const at = unlock && st.notStocked ? gearUnlockLevel(unlock) : null;
  if (!at) return st.reason;
  const gear = content.gear.find((g) => g.id === unlock)!;
  return `The ${gear.name} that opens it is stocked once your homestead reaches ${at.title} (level ${at.level}).`;
}

const ordinal = (n: number) => ['first', 'second', 'third', 'fourth', 'fifth'][n - 1] ?? `${n}th`;
/** "the Badger Setts", but "The Old Well" as it's named. */
const the = (name: string) => (name.startsWith('The ') ? name : `the ${name}`);

function ZonePicker({ g, store, onClose }: { g: GameState; store: Store; onClose: () => void }) {
  const season = seasonOf(g.round);
  // The underground belongs to the family's story: daily years stay on the surface.
  const story = g.mode === 'story';
  const below = story && content.zones.some((z) => layersOpen(g.perks.generation, z.id) > 0);
  return (
    <SheetFrame title="Where to forage?" onClose={onClose} tall>
      <p class="small muted">
        A trip takes 1 action. Turn cards on the forest floor as long as you dare; each one tells you how many hazards lie beside it. A second
        hazard busts the trip and you keep only your first {bustKeep(g)} finds. Each trip walks a zone's deck once, so you can only go so deep.
        From the {ordinal(content.rules.deepAt)} patch in, every patch hides one rare find.
        {below && ' From there a way leads down into the layers below: each is a single patch with one artifact, and more hazards the deeper you go.'}
      </p>
      <div class="zones">
        {content.zones.map((z) => {
          const st = zoneStatus(g, z);
          const finds = Array.from(new Set(z.deck.filter((e) => e.card.type === 'specimen').map((e) => (e.card as { species: string }).species)));
          // The rare mushroom deep in this zone right now (each zone has one for every season it's open).
          const deep = z.deep.flatMap((card) => (card.type === 'specimen' && inSeason(card.species, season) ? [card.species] : []));
          const layers = story ? Array.from({ length: layersOpen(g.perks.generation, z.id) }, (_, d) => layerDef(z.id, d + 1)!) : [];
          const clue = story ? nextClue(g.perks.generation, z.id) : null;
          return (
            <button
              class={`zone ${st.open ? '' : 'locked'}`}
              style={{ '--zone': z.color } as any}
              disabled={!st.open || g.actionsLeft < 1}
              onClick={() => store.act({ type: 'forage', zone: z.id }) && onClose()}
            >
              <span class="zone-wash" aria-hidden="true" />
              <span class="zone-name">{z.name}</span>
              <span class="zone-blurb">{st.open ? z.blurb : lockedText(z.unlock, st)}</span>
              <span class="zone-meta">
                <span>Hazard: {z.hazard}</span>
                <span>{finds.map((id) => content.species[id].group).join(' · ')}</span>
              </span>
              {deep.length > 0 && (
                <span class="zone-deep">
                  Deep in, this {season}: {deep.map((id) => content.species[id].group).join(' · ')}
                </span>
              )}
              {layers.length > 0 && <span class="zone-under">Below: {layers.map((l) => l.name).join(' → ')}</span>}
              {clue && <span class="zone-clue">{clue.layer.clue}</span>}
            </button>
          );
        })}
      </div>
    </SheetFrame>
  );
}

function Trip({ g, store, onClose }: { g: GameState; store: Store; onClose: () => void }) {
  const trip = g.forage!;
  const zone = content.zones.find((z) => z.id === trip.zone)!;
  const last = trip.drawn[trip.drawn.length - 1];
  const open = trip.status === 'open';
  const cap = basketCapacity(g);
  const knife = g.gear.includes('knife');
  const n = content.rules.patchSize;
  // Underground, each layer is a single patch: the way on is down, never deeper.
  const under = trip.layer > 0;
  const layer = under ? layerDef(trip.zone, trip.layer) : null;
  const down = descendStatus(g);
  const next = down.open ? layerDef(trip.zone, trip.layer + 1) : null;
  const start = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const flip = (index: number) => {
    const r = store.act({ type: 'flip', index });
    if (r?.kind === 'draw') {
      if (r.outcome === 'bust') buzz([60, 40, 120]);
      else if (r.outcome === 'hazard') buzz(40);
    }
  };
  // A trip is one pass through the zone's deck: once it is dealt out, there is nothing deeper.
  const left = g.decks[trip.zone].draw.length;
  const end = under || left === 0;
  const deeper = () => open && !end && store.act({ type: 'deeper' });
  const descend = () => open && next && store.act({ type: 'descend' });
  // The deck swipes down a layer whenever the way is open, and deeper into the zone otherwise.
  const swipe = () => (next ? descend() : deeper());

  const kept = g.basket.filter((b) => trip.picked.includes(b.uid));
  const coins = trip.drawn.filter((d) => d.card.type === 'coins').reduce((sum, d) => sum + (d.card as { amount: number }).amount, 0);
  const subs = trip.drawn.filter((d) => d.card.type === 'substrate').length;
  const hidden = trip.patch.filter((p) => !p.flipped).length;
  const turnedHere = trip.patch.some((p) => p.flipped);
  const limit = bustAt(g);
  const deepHere = trip.patch.find((p) => p.deep);
  const lastWasDeep = !!deepHere?.flipped && last?.card === deepHere.card;
  const deepAt = content.rules.deepAt;
  const justCleared = store.last?.kind === 'draw' && !!store.last.cleared;
  // The way down is one face-down card in the zone's last patch, and in each layer above the deepest open one.
  const way = trip.patch.find((p) => p.card.type === 'entrance');
  const below = layersOpen(g.perks.generation, trip.zone) > trip.layer;
  const wayDown = next
    ? ` A way leads down to ${the(next.name)}.`
    : way
      ? ` ${deepHere ? 'Another' : 'One card'} hides the way down.`
      : below && !under
        ? ` The way down lies in the ${hasSetEffect(g.perks.sets, 'shortcut') ? 'first deep' : 'last'} patch.`
        : '';
  const relics = trip.relics.filter((r) => !trip.lost.includes(r.uid)).map((r) => cardTitle({ type: 'artifact', artifact: r.artifact }));
  const message = justCleared
    ? `Nothing left unturned: every card in the ${zone.name} but its hazards.`
    : last && lastWasDeep
      ? last.card.type === 'coins'
        ? `Rare find! A forager's cache, tucked under a root: ${last.card.amount} coins.`
        : last.card.type === 'artifact'
          ? outcomeText(last.outcome, last.card)
          : `Rare find! ${outcomeText(last.outcome, last.card, last.dropped)}`
      : last && (turnedHere || trip.status === 'busted')
        ? last.outcome === 'hazard' && limit - trip.hazards > 1
          ? `A hazard. ${limit - trip.hazards} more this trip and you bust.`
          : last.outcome === 'bust'
            ? `Bust! You scramble home with only your first ${bustKeep(g)} finds.`
            : outcomeText(last.outcome, last.card, last.dropped)
        : !open
          ? 'The faded cards are what you walked past.'
          : layer
            ? `${layer.blurb}${deepHere ? ' Something old lies hidden in this patch.' : ''}${wayDown}`
            : deepHere
              ? `Deep in the woods. One card on this ${end ? 'last patch' : 'patch'} hides a rare find.${wayDown}`
              : end && trip.depth > 1
                ? `The far edge of the zone. This is the last patch.${wayDown}`
                : trip.depth > 1
                  ? `Deeper in. The hazards you already met still count.${trip.depth < deepAt ? ' One patch further and rare finds start to turn up.' : ''}${wayDown}`
                  : `Tap a card to turn it. Each one you turn shows how many hazards lie beside it.${wayDown}`;

  return (
    <div class={`overlay forage-screen ${under ? 'under' : ''}`} style={{ '--zone': zone.color } as any}>
      <div class="forage-wash" aria-hidden="true" />
      <header class="forage-head">
        <div>
          <div class="eyebrow">
            {layer ? `Below the ${zone.name} · ${ordinal(trip.layer)} layer` : `Foraging${trip.depth > 1 ? ` · ${trip.depth} patches deep` : ''}`}
          </div>
          <h2>{layer ? layer.name : zone.name}</h2>
        </div>
        <div class="forage-stats">
          <span class="hazards" aria-label={`${trip.hazards} of ${limit} hazards`}>
            {knife && (
              <span class={`knife ${trip.knifeUsed ? 'used' : ''}`} title="Mushroom Knife">
                <Icon name="knife" size={20} />
              </span>
            )}
            {Array.from({ length: limit }, (_, i) => (
              <span class={`hz ${i < trip.hazards ? 'on' : ''}`}>
                <Icon name="hazard" size={20} />
              </span>
            ))}
          </span>
          <span class="chip">
            <Icon name="basket" size={16} /> {g.basket.length}/{cap}
          </span>
        </div>
      </header>

      <p class={`floor-msg ${last?.outcome ?? ''} ${lastWasDeep || justCleared ? 'rare' : ''}`} aria-live="polite">
        {message}
      </p>

      <div class="floor-wrap">
        <div class="floor" style={{ '--n': n } as any} role="grid" aria-label="Forest floor">
          {trip.patch.map((p, i) => {
            // Once the trip is over, the cards you didn't turn are shown faintly: what you walked past.
            const shown = p.flipped || !open;
            const near = hazardsNear(trip, i);
            const label = p.flipped
              ? `${cardLabel(p.card, p.outcome)}${p.card.type === 'hazard' ? '' : `, ${near} hazard${near === 1 ? '' : 's'} beside it`}`
              : open
                ? `Face-down card, row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}`
                : `Passed by: ${p.deep && p.card.type !== 'artifact' ? 'a rare find, ' : ''}${cardLabel(p.card, null)}`;
            // The rare find looks like any other card until it's turned (or the trip ends), then it shines.
            const rare = p.deep && shown;
            // With the Forager's Lantern, a rare find or an artifact glints through the leaves before it's turned.
            const glint = p.deep && !shown && glints(g);
            return (
              <button
                key={`${trip.depth}-${trip.layer}-${i}`}
                class={`fc ${p.card.type} ${p.outcome ?? ''} ${shown ? 'up' : ''} ${!p.flipped && !open ? 'passed' : ''} ${rare ? 'deep' : ''} ${rare && p.flipped ? 'found' : ''} ${glint ? 'glint' : ''}`}
                style={{ '--i': i } as any}
                disabled={!open || p.flipped}
                onClick={() => flip(i)}
                aria-label={label}
              >
                <span class="fc-inner">
                  <span class="fc-back" aria-hidden="true">
                    <Icon name="leaf" size={22} />
                  </span>
                  <span class="fc-front" aria-hidden="true">
                    {rare && (
                      <span class="rare-tag">
                        <Icon name="spark" size={11} /> {p.card.type === 'artifact' ? 'Artifact' : 'Rare'}
                      </span>
                    )}
                    <CardArt card={p.card} outcome={p.outcome} />
                    <span class="fc-title">{cardLabel(p.card, p.outcome)}</span>
                    {p.flipped && p.card.type !== 'hazard' && (
                      <span class={`near n${near}`} title={`${near} hazard${near === 1 ? '' : 's'} beside this card`}>
                        <Icon name="hazard" size={12} />
                        {near}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {open ? (
        <footer class="forage-foot">
          <div
            class={`deck ${dragging ? 'dragging' : ''} ${end && !next ? 'empty' : ''} ${next ? 'down' : ''}`}
            role="button"
            tabIndex={0}
            aria-disabled={end && !next}
            aria-label={
              next
                ? `Descend into ${the(next.name)}. ${hidden} unturned card${hidden === 1 ? '' : 's'} stay behind.`
                : (under || (way && end)) && !down.open
                  ? down.reason
                  : end
                    ? 'End of the zone: the whole deck is dealt.'
                    : `Go deeper: deal a fresh patch from the ${left} cards left. ${hidden} unturned card${hidden === 1 ? '' : 's'} stay behind.`
            }
            onPointerDown={(e) => {
              // Keep receiving this pointer after it leaves the deck, so a mouse drag works like a touch swipe.
              (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
              start.current = e.clientY;
              setDragging(true);
            }}
            onPointerCancel={() => {
              start.current = null;
              setDragging(false);
            }}
            onPointerUp={(e) => {
              const dy = start.current === null ? 0 : e.clientY - start.current;
              start.current = null;
              setDragging(false);
              if (dy < -30) swipe();
            }}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && swipe()}
          >
            {(next || left > 1) && <div class="deck-card d3" />}
            {(next || left > 0) && <div class="deck-card d2" />}
            <div class="deck-card d1">
              {next ? (
                <>
                  <span>Swipe up</span>
                  <small>to descend</small>
                  <small>{ordinal(trip.layer + 1)} layer</small>
                </>
              ) : way && end ? (
                <>
                  <span>Way down</span>
                  <small>hidden in this patch</small>
                </>
              ) : under ? (
                <>
                  <span>No way down</span>
                  <small>as deep as you can go</small>
                </>
              ) : end ? (
                <>
                  <span>End of the zone</span>
                  <small>nothing deeper</small>
                </>
              ) : (
                <>
                  <span>Swipe up</span>
                  <small>{trip.depth + 1 >= deepAt ? 'rare finds ahead' : 'to go deeper'}</small>
                  <small>{left <= n * n - (trip.depth + 1 >= deepAt ? 1 : 0) ? `last ${left} card${left === 1 ? '' : 's'}` : `${left} cards left`}</small>
                </>
              )}
            </div>
          </div>
          <div class="foot-actions">
            <button class="btn big" onClick={() => store.act({ type: 'stopForage' })}>
              Head home
            </button>
            {next && (
              <button class="btn small descend" onClick={descend}>
                Descend to {the(next.name)}
                {hidden ? ` (${hidden} unturned left behind)` : ''}
              </button>
            )}
            {!end && (
              <button class="btn small ghost" onClick={deeper}>
                Go deeper{hidden ? ` (${hidden} unturned left behind)` : ''}
              </button>
            )}
          </div>
        </footer>
      ) : (
        <footer class="forage-foot done">
          <div class={`trip-end ${trip.status}`}>
            <h3>{trip.status === 'busted' ? 'Busted!' : 'Heading home'}</h3>
            <p>
              {kept.length ? `${kept.length} specimen${kept.length === 1 ? '' : 's'}` : 'No specimens'}
              {coins ? `, ${coins} coins` : ''}
              {subs ? `, ${subs} substrate` : ''}
              {relics.length ? `, and the ${relics.join(' and the ')}` : ''}.{trip.lost.length ? ` Lost in the scramble: ${trip.lost.length}.` : ''}
            </p>
          </div>
          <button
            class="btn primary big wide"
            onClick={() => {
              store.act({ type: 'closeTrip' });
              onClose();
            }}
          >
            Back to the homestead
          </button>
        </footer>
      )}
      {store.error && (
        <div class="toast" role="alert">
          {store.error}
        </div>
      )}
    </div>
  );
}

export function Forage({ g, store, onClose }: { g: GameState; store: Store; onClose: () => void }) {
  if (g.forage) return <Trip g={g} store={store} onClose={onClose} />;
  return <ZonePicker g={g} store={store} onClose={onClose} />;
}
