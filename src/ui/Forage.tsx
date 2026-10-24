import { useRef } from 'preact/hooks';
import { basketCapacity, content, gearUnlockLevel, zoneStatus, type Card, type DrawOutcome, type GameState } from '../core';
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

export function CardFace({ card, outcome, small }: { card: Card; outcome?: DrawOutcome; small?: boolean }) {
  const size = small ? 34 : 120;
  const cls = `fcard ${card.type} ${outcome ?? ''} ${small ? 'mini' : ''}`;
  return (
    <div class={cls}>
      <div class="fcard-art">
        {card.type === 'specimen' &&
          (outcome === 'known' ? <Mushroom species={card.species} size={size} /> : <Unknown species={card.species} size={size} />)}
        {card.type === 'substrate' && <SubstrateArt substrate={card.substrate} size={size} />}
        {card.type === 'coins' && <Icon name="coin" size={small ? 26 : 84} />}
        {card.type === 'hazard' && <Icon name="hazard" size={small ? 26 : 84} />}
      </div>
      {!small && (
        <>
          <div class="fcard-kind">{card.type === 'specimen' ? 'Specimen' : card.type === 'hazard' ? 'Hazard' : 'Find'}</div>
          <div class="fcard-title">{outcome === 'known' && card.type === 'specimen' ? name(card.species) : cardTitle(card)}</div>
        </>
      )}
    </div>
  );
}

function lockedText(unlock: string | null, st: { reason: string; notStocked?: boolean }) {
  const at = unlock && st.notStocked ? gearUnlockLevel(unlock) : null;
  if (!at) return st.reason;
  const gear = content.gear.find((g) => g.id === unlock)!;
  return `The ${gear.name} that opens it is stocked once your homestead reaches ${at.title} (level ${at.level}).`;
}

function ZonePicker({ g, store, onClose }: { g: GameState; store: Store; onClose: () => void }) {
  return (
    <SheetFrame title="Where to forage?" onClose={onClose} tall>
      <p class="small muted">A trip takes 1 action. Draw as long as you dare: a second hazard busts the trip and you keep only your first two finds.</p>
      <div class="zones">
        {content.zones.map((z) => {
          const st = zoneStatus(g, z);
          const finds = Array.from(new Set(z.deck.filter((e) => e.card.type === 'specimen').map((e) => (e.card as { species: string }).species)));
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
  const start = useRef<number | null>(null);

  const draw = () => {
    const r = store.act({ type: 'draw' });
    if (r?.kind === 'draw') {
      if (r.outcome === 'bust') buzz([60, 40, 120]);
      else if (r.outcome === 'hazard') buzz(40);
    }
  };

  const kept = g.basket.filter((b) => trip.picked.includes(b.uid));
  const coins = trip.drawn.filter((d) => d.card.type === 'coins').reduce((n, d) => n + (d.card as { amount: number }).amount, 0);
  const subs = trip.drawn.filter((d) => d.card.type === 'substrate').length;

  return (
    <div class="overlay forage-screen" style={{ '--zone': zone.color } as any}>
      <div class="forage-wash" aria-hidden="true" />
      <header class="forage-head">
        <div>
          <div class="eyebrow">Foraging</div>
          <h2>{zone.name}</h2>
        </div>
        <div class="forage-stats">
          <span class="hazards" aria-label={`${trip.hazards} of ${content.rules.bustAt} hazards`}>
            {knife && <span class={`knife ${trip.knifeUsed ? 'used' : ''}`} title="Mushroom Knife">
              <Icon name="knife" size={20} />
            </span>}
            {Array.from({ length: content.rules.bustAt }, (_, i) => (
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

      <div class="table">
        {open ? (
          <div
            class="deck"
            role="button"
            tabIndex={0}
            aria-label="Draw a card"
            onPointerDown={(e) => (start.current = e.clientY)}
            onPointerUp={(e) => {
              const dy = start.current === null ? 0 : e.clientY - start.current;
              start.current = null;
              if (dy < 12) draw();
            }}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && draw()}
          >
            <div class="deck-card d3" />
            <div class="deck-card d2" />
            <div class="deck-card d1">
              <span>Swipe up</span>
              <small>to draw</small>
              <small class="deck-count">{g.decks[trip.zone].draw.length || g.decks[trip.zone].discard.length} cards</small>
            </div>
          </div>
        ) : (
          <div class={`trip-end ${trip.status}`}>
            <h3>{trip.status === 'busted' ? 'Busted!' : 'Heading home'}</h3>
            <p>
              {kept.length ? `${kept.length} specimen${kept.length === 1 ? '' : 's'}` : 'No specimens'}
              {coins ? `, ${coins} coins` : ''}
              {subs ? `, ${subs} substrate` : ''}.
              {trip.lost.length ? ` Lost in the scramble: ${trip.lost.length}.` : ''}
            </p>
          </div>
        )}
        {last && (
          <div class="drawn" key={trip.drawn.length}>
            <CardFace card={last.card} outcome={last.outcome} />
            <p class={`outcome ${last.outcome}`}>{outcomeText(last.outcome, last.card)}</p>
          </div>
        )}
        {!last && open && <p class="hint">Every card is a small mystery: a specimen, a find, or a hazard.</p>}
      </div>

      <div class="trail" aria-label="Cards drawn this trip">
        {trip.drawn.map((d) => (
          <CardFace card={d.card} outcome={d.outcome} small />
        ))}
      </div>

      <footer class="forage-foot">
        {open ? (
          <>
            <button class="btn primary big" onClick={draw}>
              Draw
            </button>
            <button class="btn big" onClick={() => store.act({ type: 'stopForage' })}>
              Stop and head home
            </button>
          </>
        ) : (
          <button
            class="btn primary big wide"
            onClick={() => {
              store.act({ type: 'closeTrip' });
              onClose();
            }}
          >
            Back to the homestead
          </button>
        )}
      </footer>
      {store.error && (
        <div class="toast" role="alert">
          {store.error}
        </div>
      )}
      <span class="sr-only" aria-live="polite">
        {last ? `${cardTitle(last.card)}: ${outcomeText(last.outcome, last.card)}` : ''}
      </span>
    </div>
  );
}

export function Forage({ g, store, onClose }: { g: GameState; store: Store; onClose: () => void }) {
  if (g.forage) return <Trip g={g} store={store} onClose={onClose} />;
  return <ZonePicker g={g} store={store} onClose={onClose} />;
}
