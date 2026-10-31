import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import {
  basketCapacity,
  bustAt,
  bustKeep,
  cellarReady,
  content,
  descendCost,
  descendStatus,
  digStatus,
  gearUnlockLevel,
  glints,
  hasSetEffect,
  hazardsNear,
  inSeason,
  layerDef,
  layersOpen,
  nextClue,
  recoveryCost,
  seasonOf,
  speciesOpen,
  zoneStatus,
  type Card,
  type DrawOutcome,
  type GameState,
} from '../core';
import { Icon, Mushroom, SubstrateArt, Unknown } from './art';
import { SheetFrame } from './Game';
import type { Store } from './store';
import { artifactText, bare, bustText, cardTitle, digText, fallText, name, outcomeText } from './text';

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

/** How each hazard plays out when it's turned: hazards that feel alike share a reveal. Any new one gets a plain jolt. */
const hazardKinds: Record<string, string> = {
  Ticks: 'ticks',
  'Sudden Rain': 'rain',
  'High Water': 'water',
  'Deep Water': 'water',
  'Rising Water': 'water',
  'Strong Current': 'water',
  Bog: 'bog',
  Mudslip: 'bog',
  'Slick Rocks': 'slip',
  'Slick Stone': 'slip',
  'Loose Earth': 'slip',
  Deadfall: 'fall',
  Rockfall: 'fall',
  'Falling Stone': 'fall',
  Collapse: 'fall',
  'Crumbling Brick': 'fall',
  'Ash Slide': 'ash',
  'Ash Pit': 'ash',
  'Smoke Pocket': 'ash',
  'Bad Air': 'ash',
  'Lost Trail': 'lost',
  'Dead End': 'lost',
  'Bramble Wall': 'tangle',
  'Tangled Roots': 'tangle',
  'Low Ceiling': 'low',
  'Low Tunnel': 'low',
  'Sheer Drop': 'drop',
  'Rotten Planks': 'drop',
};
const hazardKind = (name: string) => hazardKinds[name] ?? 'jolt';

/** The weather or ground a hazard brings across its card as it's turned: drawn over the face, gone once it has passed. */
function HazardFx({ kind }: { kind: string }) {
  const bits = kind === 'ticks' || kind === 'fall' || kind === 'ash' || kind === 'bog' ? [0, 1, 2] : [];
  return (
    <span class={`hz-fx ${kind}`} aria-hidden="true">
      {bits.map((k) => (
        <i style={{ '--k': k } as any} />
      ))}
      {kind === 'lost' && (
        <svg viewBox="0 0 100 125" preserveAspectRatio="none">
          <path d="M14 122 C30 96 72 106 60 78 S18 50 40 30 S88 22 70 4" />
        </svg>
      )}
      {kind === 'tangle' && (
        <svg viewBox="0 0 100 125" preserveAspectRatio="none">
          <path pathLength="1" d="M-4 30 Q30 52 50 40 T104 58 M30 46 l-4 -8 M62 44 l6 -7 M84 52 l2 -9" />
          <path pathLength="1" d="M104 88 Q70 70 48 86 T-4 96 M70 76 l3 -8 M38 90 l-5 7 M16 94 l-2 -9" />
        </svg>
      )}
    </span>
  );
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
          const finds = Array.from(new Set(z.deck.filter((e) => e.card.type === 'specimen' && (!e.unlock || speciesOpen(e.unlock, g.perks))).map((e) => (e.card as { species: string }).species)));
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

const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

type Layer = NonNullable<ReturnType<typeof layerDef>>;

/**
 * Going down: the way-down card lifts off the floor and grows to fill the screen, then the view walks
 * into its mouth until all is dark. `onInside` deals the layer below; the dark then lifts off it.
 */
function Descent({ from, layer, depth, onInside, onDone }: { from: DOMRect; layer: Layer; depth: number; onInside: () => void; onDone: () => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const dim = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const w = wrap.current!;
    const el = card.current!;
    const to = el.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const s = from.width / to.width;
    let live = true;
    w.focus();
    (async () => {
      try {
        dim.current!.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, easing: 'ease-out', fill: 'both' });
        await el.animate(
          [
            { transform: `translate(${dx}px, ${dy}px) scale(${s})` },
            { transform: 'translate(0, 0) scale(1.04)', offset: 0.8 },
            { transform: 'none' },
          ],
          { duration: 700, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)', fill: 'both' },
        ).finished;
        el.classList.add('shown');
        await wait(650);
        if (!live) return;
        // Into the cave: zoom on the dark of its mouth, just above the steps.
        const art = el.querySelector('svg')!.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        el.style.transformOrigin = `${art.left + art.width / 2 - box.left}px ${art.top + art.height * 0.55 - box.top}px`;
        el.classList.add('entering');
        w.classList.add('dark');
        await el.animate([{ transform: 'none' }, { transform: 'scale(24)' }], { duration: 1000, easing: 'cubic-bezier(0.6, 0, 0.85, 0.35)', fill: 'forwards' })
          .finished;
        if (!live) return;
        el.style.visibility = 'hidden';
        onInside();
        await w.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, delay: 150, easing: 'ease-out', fill: 'forwards' }).finished;
      } catch {
        // A cancelled animation: the screen is going away, so there's nothing left to finish.
      }
      if (live) onDone();
    })();
    return () => {
      live = false;
    };
  }, []);
  return (
    <div class="descent" ref={wrap} tabIndex={-1} role="status" aria-label={`Descending into ${the(layer.name)}`}>
      <div class="descent-dim" ref={dim} />
      <div class="descent-card" ref={card} aria-hidden="true">
        <span class="descent-eyebrow">The way down</span>
        <Icon name="way" size={44} />
        <span class="descent-name">{layer.name}</span>
        <span class="descent-depth">{ordinal(depth)} layer</span>
      </div>
    </div>
  );
}

/** The Founder's Cellar, found: the place, then the family's story, ending. */
function Cellar({ onHome }: { onHome: () => void }) {
  const { cache } = content;
  const wrap = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => wrap.current?.focus(), []);
  return (
    <div class="cellar" ref={wrap} tabIndex={-1} role="dialog" aria-label={cache.name}>
      <div class="cellar-page">
        <div class="eyebrow">Found at last</div>
        <h2>{cache.name}</h2>
        <p>{cache.place}</p>
        <p class="lore-line">{cache.ending}</p>
        <p class="small cellar-points">
          <Icon name="spark" size={14} /> {cache.points} festival points this year, and a place in the field journal for good.
        </p>
        <button class="btn primary big wide" onClick={onHome}>
          Back to the homestead
        </button>
      </div>
    </div>
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
  // The stakes of the next layer, named before going down.
  const fallNext = next ? descendCost(g) : null;
  const start = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const floor = useRef<HTMLDivElement>(null);
  // While the way down plays out, the trip takes no other input.
  const [descent, setDescent] = useState<{ from: DOMRect; layer: Layer; depth: number } | null>(null);
  const [arrived, setArrived] = useState<number | null>(null);
  // A hazard plays out on its card, and a bust shakes the floor after it: the trip waits for both.
  const [hold, setHold] = useState<{ index: number; kind: string; bust: boolean } | null>(null);
  const holding = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(holding.current), []);
  // A dig asks first, since it ends the trip; once the Founder's Cellar is found, it opens full screen.
  const [digAsk, setDigAsk] = useState<number | null>(null);
  const [dugUnder, setDugUnder] = useState<string | null>(null);
  const [cellar, setCellar] = useState(false);
  const busy = !!descent || !!hold;
  const home = () => {
    if (busy) return;
    store.act({ type: 'closeTrip' });
    onClose();
  };
  const dig = (index: number) => {
    setDigAsk(null);
    const card = trip.patch[index]?.card;
    setDugUnder(card?.type === 'ground' ? card.name : null);
    const r = store.act({ type: 'dig', index });
    if (r?.kind === 'dig' && r.dug === 'found') buzz([40, 60, 40]);
    else if (r?.kind === 'dig' && r.dug === 'truffle') buzz(30);
  };

  const flip = (index: number) => {
    if (busy) return;
    const card = trip.patch[index]?.card;
    const r = store.act({ type: 'flip', index });
    if (r?.kind === 'draw') {
      if (r.outcome === 'bust') buzz([60, 40, 120]);
      else if (r.outcome === 'hazard') buzz(40);
      if (card?.type === 'hazard' && !reducedMotion()) {
        const bust = r.outcome === 'bust';
        setHold({ index, kind: hazardKind(card.name), bust });
        holding.current = setTimeout(() => setHold(null), bust ? 2000 : 1150);
      }
    }
  };
  // A trip is one pass through the zone's deck: once it is dealt out, there is nothing deeper.
  const left = g.decks[trip.zone].draw.length;
  const end = under || left === 0;
  const deeper = () => !busy && open && !end && store.act({ type: 'deeper' });
  const descend = () => {
    if (busy || !open || !next) return;
    const way = floor.current?.querySelector<HTMLElement>('.fc.entrance');
    if (!way || reducedMotion() || !way.animate) return store.act({ type: 'descend' });
    setDescent({ from: way.getBoundingClientRect(), layer: next, depth: trip.layer + 1 });
  };
  const inside = () => {
    // The layer below is dealt in the dark; its cards come up a beat later, as the dark lifts.
    setArrived(trip.layer + 1);
    store.act({ type: 'descend' });
  };
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
    ? ` A way leads down to ${the(next.name)}.${fallNext !== null ? ` ${fallText(fallNext)}.` : ''}`
    : way
      ? ` ${deepHere ? 'Another' : 'One card'} hides the way down.`
      : below && !under
        ? ` The way down lies in the ${hasSetEffect(g.perks.sets, 'shortcut') ? 'first deep' : 'last'} patch.`
        : '';
  const relics = trip.relics.filter((r) => !trip.lost.includes(r.uid)).map((r) => cardTitle({ type: 'artifact', artifact: r.artifact }));
  const { dig: digRule } = content.rules;
  const truffle = name(digRule.species);
  const digResult = store.last?.kind === 'dig' ? store.last : null;
  const inTruffleSeason = inSeason(digRule.species, seasonOf(g.round));
  // Truffle ground: a turned truffle tree in truffle season, once a Spade is in the shop, hints where to dig.
  const truffleGround = (card: Card) =>
    !under && card.type === 'ground' && digRule.hosts.includes(card.name) && inTruffleSeason && (g.gear.includes('spade') || g.perks.shop.includes('spade'));
  const dugText = trip.dug
    ? digText(trip.dug, { host: !!dugUnder && digRule.hosts.includes(dugUnder), inSeason: inTruffleSeason, cellarReady: cellarReady(g) })
    : '';
  // A fall below ground costs time next month: the worst one this month, if there's been more than one.
  const fall = trip.layer && g.recovery ? recoveryCost(g.recovery.layer, g.perks.sets) : 0;
  const message = trip.dug === 'truffle'
    ? `${dugText} ${digResult?.outcome ? outcomeText(digResult.outcome, { type: 'specimen', species: digRule.species }, digResult.dropped) : ''}`
    : trip.dug
      ? dugText
      : justCleared && layer
    ? `${last && lastWasDeep && last.card.type === 'artifact' ? `${artifactText(g, last.card.artifact)} ` : ''}Nothing left below: every card in the ${bare(layer.name)} but its hazards.`
      : justCleared
    ? `Nothing left unturned: every card in the ${bare(zone.name)} but its hazards.`
    : last && lastWasDeep
      ? last.card.type === 'coins'
        ? `Rare find! A forager's cache, tucked under a root: ${last.card.amount} coins.`
        : last.card.type === 'artifact'
          ? artifactText(g, last.card.artifact)
          : `Rare find! ${outcomeText(last.outcome, last.card, last.dropped)}`
      : last && (turnedHere || trip.status === 'busted')
        ? last.outcome === 'hazard' && limit - trip.hazards > 1
          ? `A hazard. ${limit - trip.hazards} more this trip and you bust.`
          : last.outcome === 'bust'
            ? bustText(bustKeep(g), fall)
            : last.outcome === 'wayDown' && fallNext !== null
              ? `${outcomeText(last.outcome, last.card)} ${fallText(fallNext)}.`
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
    <div class={`overlay forage-screen ${under ? 'under' : ''} ${hold?.bust ? 'busting' : ''}`} aria-busy={busy} style={{ '--zone': zone.color } as any}>
      <div class="forage-wash" aria-hidden="true" />
      <header class="forage-head">
        <div>
          <div class="eyebrow">
            {layer ? `Below the ${bare(zone.name)} ·${ordinal(trip.layer)} layer` : `Foraging${trip.depth > 1 ? ` · ${trip.depth} patches deep` : ''}`}
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
        <div class={`floor ${under && arrived === trip.layer ? 'arriving' : ''}`} ref={floor} style={{ '--n': n } as any} role="grid" aria-label="Forest floor">
          {trip.patch.map((p, i) => {
            // Once the trip is over, the cards you didn't turn are shown faintly: what you walked past.
            const shown = p.flipped || !open;
            const near = hazardsNear(trip, i);
            // The way down, once turned, is a door: tap it to go down.
            const door = open && p.flipped && p.card.type === 'entrance' && !!next;
            // With a Spade, turned plain ground can be dug.
            const spade = open && p.flipped && p.card.type === 'ground' && digStatus(g, i).open;
            const truffly = p.flipped && truffleGround(p.card);
            // An artifact the family already has: it still scores, at less.
            const again = p.card.type === 'artifact' && g.perks.clues.includes(p.card.artifact);
            const label = p.flipped
              ? door
                ? `${cardLabel(p.card, p.outcome)}: descend into ${the(next!.name)}`
                : spade
                  ? `${cardLabel(p.card, p.outcome)}${truffly ? ', truffle ground' : ''}, ${near} hazard${near === 1 ? '' : 's'} beside it: dig here`
                : `${cardLabel(p.card, p.outcome)}${truffly ? ', truffle ground' : ''}${again ? ', already in the cabinet' : ''}${p.card.type === 'hazard' ? '' : `, ${near} hazard${near === 1 ? '' : 's'} beside it`}`
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
                class={`fc ${p.card.type} ${p.outcome ?? ''} ${shown ? 'up' : ''} ${!p.flipped && !open ? 'passed' : ''} ${rare ? 'deep' : ''} ${rare && p.flipped ? 'found' : ''} ${glint ? 'glint' : ''} ${door ? 'door' : ''} ${door && descent ? 'lifted' : ''} ${spade ? 'diggable' : ''} ${hold?.index === i ? `hz-${hold.kind}` : ''}`}
                style={{ '--i': i } as any}
                disabled={!open || (p.flipped && !door && !spade)}
                onClick={() => (door ? descend() : spade ? !busy && setDigAsk(i) : flip(i))}
                aria-label={label}
              >
                <span class="fc-inner">
                  <span class="fc-back" aria-hidden="true">
                    <Icon name="leaf" size={22} />
                  </span>
                  <span class="fc-front" aria-hidden="true">
                    {rare && (
                      <span class="rare-tag">
                        <Icon name="spark" size={11} /> {p.card.type === 'artifact' ? (again ? 'In cabinet' : 'Artifact') : 'Rare'}
                      </span>
                    )}
                    {truffly && <span class="truffle-tag">truffle ground</span>}
                    <CardArt card={p.card} outcome={p.outcome} />
                    {hold?.index === i && <HazardFx kind={hold.kind} />}
                    <span class="fc-title">{cardLabel(p.card, p.outcome)}</span>
                    {door && <span class="door-tag">Tap to go down</span>}
                    {spade && (
                      <span class="dig-tag" title="Dig here">
                        <Icon name="spade" size={12} />
                      </span>
                    )}
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
                ? `Descend into ${the(next.name)}. ${hidden} unturned card${hidden === 1 ? '' : 's'} stay behind.${fallNext !== null ? ` ${fallText(fallNext)}.` : ''}`
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
            <button class="btn big" onClick={() => !busy && store.act({ type: 'stopForage' })}>
              Head home
            </button>
            {next && (
              <button class="btn small descend" onClick={descend}>
                Descend to {the(next.name)}
                {hidden ? ` (${hidden} unturned left behind)` : ''}
                {fallNext !== null && <small class="fall-cost">{fallText(fallNext)}</small>}
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
          <div class={`trip-end ${trip.status} ${trip.dug ?? ''}`}>
            <h3>
              {trip.status === 'busted'
                ? 'Busted!'
                : trip.dug === 'found'
                  ? content.cache.name
                  : trip.dug === 'truffle'
                    ? `A ${truffle.toLowerCase()}!`
                    : trip.dug === 'noRoom'
                      ? 'No room for it'
                      : trip.dug === 'empty'
                        ? 'Nothing here'
                        : 'Heading home'}
            </h3>
            <p>
              {kept.length ? `${kept.length} specimen${kept.length === 1 ? '' : 's'}` : 'No specimens'}
              {coins ? `, ${coins} coins` : ''}
              {subs ? `, ${subs} substrate` : ''}
              {relics.length ? `, and the ${relics.join(' and the ')}` : ''}.{trip.lost.length ? ` Lost in the scramble: ${trip.lost.length}.` : ''}
            </p>
          </div>
          {trip.dug === 'found' ? (
            <button class="btn primary big wide" onClick={() => setCellar(true)}>
              Into {content.cache.name.replace(/^The /, 'the ')}
            </button>
          ) : (
            <button class="btn primary big wide" onClick={home}>
              Back to the homestead
            </button>
          )}
        </footer>
      )}
      {digAsk !== null && trip.patch[digAsk] && (
        <SheetFrame title={`Dig under the ${cardTitle(trip.patch[digAsk].card)}?`} onClose={() => setDigAsk(null)}>
          <p>Digging takes the rest of the day: you head home with what you've found, and whatever the spade turns up.</p>
          <div class="foot-actions">
            <button class="btn primary big" onClick={() => dig(digAsk)}>
              <Icon name="spade" size={18} /> Dig here
            </button>
            <button class="btn ghost" onClick={() => setDigAsk(null)}>
              Not here
            </button>
          </div>
        </SheetFrame>
      )}
      {cellar && <Cellar onHome={home} />}
      {hold && <div class={`hazard-hold ${hold.bust ? 'bust' : ''}`} aria-hidden="true" />}
      {descent && <Descent {...descent} onInside={inside} onDone={() => setDescent(null)} />}
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
