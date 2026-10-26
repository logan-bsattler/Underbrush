import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import {
  actionsPerMonth,
  basketCapacity,
  boardDef,
  canPlantOn,
  content,
  emptyGround,
  inSeason,
  isDamp,
  isShaded,
  lookalikeOn,
  masteryOf,
  mealEffect,
  orderPayment,
  plantableSquares,
  seasonOf,
  stageLength,
  type ActionResult,
  type GameState,
  type GrowthRate,
  type IdentifyResult,
  type Specimen,
  type Stage,
  type Substrate,
} from '../core';
import { BedArt, Icon, Mushroom, SubstrateArt, TreeArt, Unknown } from './art';
import { Forage } from './Forage';
import { Market } from './Market';
import { Night } from './Night';
import { Pantry } from './Pantry';
import { YearEnd } from './YearEnd';
import type { Store } from './store';
import { growthName, masteryName, name, seasonsText, squareName, stageName, substrateName, monthLabel } from './text';

export type Mode =
  | { kind: 'none' }
  | { kind: 'plant'; uid: number }
  | { kind: 'substrate'; index: number }
  | { kind: 'tent' }
  | { kind: 'cross'; a: number; b: number; hybrid: string; pick: number | null };
type Sheet =
  | null
  | { kind: 'bed'; i: number }
  | { kind: 'specimen'; uid: number }
  | { kind: 'tend' }
  | { kind: 'market' }
  | { kind: 'forage' }
  | { kind: 'weather' }
  | { kind: 'pantry' }
  | { kind: 'menu' };

export function SheetFrame({ title, onClose, children, tall }: { title: string; onClose: () => void; children: ComponentChildren; tall?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div class="sheet-wrap" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section class={`sheet paper ${tall ? 'tall' : ''}`} role="dialog" aria-label={title}>
        <header class="sheet-head">
          <h2>{title}</h2>
          <button class="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <div class="sheet-body">{children}</div>
      </section>
    </div>
  );
}

export function ActionsPips({ left, total }: { left: number; total: number }) {
  return (
    <span class="pips" aria-label={`${left} of ${total} actions left`}>
      {Array.from({ length: total }, (_, i) => (
        <span class={`pip ${i < left ? 'on' : ''}`}>
          <Icon name="leaf" size={16} />
        </span>
      ))}
    </span>
  );
}

function Hud({ g, onWeather, onPantry, onMenu }: { g: GameState; onWeather: () => void; onPantry: () => void; onMenu: () => void }) {
  const weather = content.weather.find((w) => w.id === g.weather)!;
  const stored = Object.values(g.storage).reduce((a, b) => a + b, 0);
  const meal = g.meal ? content.recipes.find((r) => r.id === g.meal) : null;
  return (
    <header class="hud">
      <div class="hud-month">
        <div class="hud-title">
          {g.finale ? 'Festival morning' : `Month ${g.round}`}
          {!g.finale && <span class="hud-season">{monthLabel(g.round)}</span>}
        </div>
        <div class="year-track" aria-hidden="true">
          {Array.from({ length: content.rules.rounds }, (_, i) => (
            <span class={`yt yt-${seasonOf(i + 1)} ${i + 1 < g.round || g.finale ? 'done' : i + 1 === g.round ? 'now' : ''}`} />
          ))}
        </div>
      </div>
      {!g.finale && (
        <button class="chip weather" onClick={onWeather} aria-label={`Weather: ${weather.name}`}>
          <Icon name={weather.id} size={18} />
          <span class="weather-name">{weather.name}</span>
        </button>
      )}
      <button
        class={`chip pantry ${meal ? 'fed' : ''}`}
        onClick={onPantry}
        aria-label={`Pantry: ${stored} stored mushroom${stored === 1 ? '' : 's'}${meal ? `. ${meal.name} this month` : ''}`}
      >
        <Icon name={meal ? 'bowl' : 'pantry'} size={18} />
        {stored}
      </button>
      <span class="chip coins" aria-label={`${g.coins} coins`}>
        <Icon name="coin" size={18} />
        {g.coins}
      </span>
      <button class="icon-btn" onClick={onMenu} aria-label="Menu">
        <Icon name="menu" />
      </button>
    </header>
  );
}

function Orders({ g, onOpen }: { g: GameState; onOpen: () => void }) {
  return (
    <div class="orders" role="list" aria-label="Festival orders">
      {g.orders.visible.map((id) => {
        const o = content.orders.find((x) => x.id === id)!;
        const ready = !!orderPayment(g.storage, o);
        return (
          <button role="listitem" class={`order ${ready ? 'ready' : ''}`} onClick={onOpen}>
            <span class="order-label">{o.label}</span>
            <span class="order-pts">{o.points}</span>
            {ready && <span class="order-ready">Ready</span>}
          </button>
        );
      })}
      {g.orders.visible.length === 0 && <div class="muted small">Every order is filled. What a festival this will be.</div>}
    </div>
  );
}

export function Farm({
  g,
  mode,
  onSquare,
  marks,
  small,
}: {
  g: GameState;
  mode?: Mode;
  onSquare?: (i: number) => void;
  marks?: Record<number, string>;
  small?: boolean;
}) {
  const targets = new Set<number>();
  if (mode?.kind === 'plant') {
    const spec = g.basket.find((b) => b.uid === mode.uid);
    if (spec) plantableSquares(g, spec.species).forEach((i) => targets.add(i));
  } else if (mode?.kind === 'substrate') emptyGround(g).forEach((i) => targets.add(i));
  else if (mode?.kind === 'tent') g.grid.forEach((sq, i) => !sq.tree && targets.add(i));
  else if (mode?.kind === 'cross') [mode.a, mode.b].forEach((i) => targets.add(i));
  const cross = mode?.kind === 'cross' ? mode : null;
  const choosing = mode && mode.kind !== 'none';
  const stream = boardDef(g.board).stream;
  const season = g.finale ? 'winter' : seasonOf(g.round);

  return (
    <div class={`farm ${small ? 'small' : ''} size-${g.size} season-${season}`} style={{ '--cols': g.size } as any}>
      {stream && (
        <div class="stream" aria-hidden="true">
          <svg viewBox="0 0 20 100" preserveAspectRatio="none">
            <path d="M10 0 Q4 12 10 25 T10 50 T10 75 T10 100" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="1.4" fill="none" />
          </svg>
          {!small && <span>stream</span>}
        </div>
      )}
      <div class="grid">
        {g.grid.map((sq, i) => {
          const isTarget = targets.has(i);
          const months = sq.species && sq.stage ? stageLength(sq.stage, content.species[sq.species].growth) : 0;
          const cls = [
            'sq',
            sq.tree ? 'tree' : '',
            isDamp(g, i) ? (stream && i % g.size === 0 ? 'damp' : 'damp spring') : '',
            sq.blight ? 'blighted' : '',
            sq.stage === 'F' && !sq.blight ? 'ready' : '',
            choosing ? (isTarget ? 'target' : 'dim') : '',
            marks?.[i] ? `mark mark-${marks[i]}` : '',
            cross?.pick === i ? 'picked' : '',
          ].join(' ');
          const label = sq.tree
            ? 'Tree'
            : sq.species
              ? `${name(sq.species)}, ${stageName[sq.stage!]}${months > 1 ? `, month ${sq.hold + 1} of ${months}` : ''}${sq.blight ? ', blighted' : ''}, ${squareName(i, g.size)}`
              : sq.substrate
                ? `Empty ${substrateName[sq.substrate]}, ${squareName(i, g.size)}`
                : `Empty ground, ${squareName(i, g.size)}`;
          return (
            <button
              key={i}
              class={cls}
              aria-label={cross && isTarget ? `${label}. ${cross.pick === i ? 'Chosen to become' : 'Choose to turn into'} ${name(cross.hybrid)}` : label}
              aria-pressed={cross && isTarget ? cross.pick === i : undefined}
              disabled={!onSquare || (choosing && !isTarget)}
              onClick={() => onSquare?.(i)}
            >
              {sq.tree ? (
                <TreeArt season={season} />
              ) : (
                <>
                  <SubstrateArt substrate={sq.substrate} season={season} />
                  {sq.species && sq.stage && <BedArt key={`${sq.species}-${sq.stage}`} species={sq.species} stage={sq.stage} />}
                  {sq.blight && <span class="mold" aria-hidden="true" />}
                  {!small && (
                    <span class="badges">
                      {sq.tent && <Icon name="tent" size={14} />}
                      {Array.from({ length: sq.dry }, () => (
                        <Icon name="dry" size={13} />
                      ))}
                    </span>
                  )}
                  {sq.species && sq.stage && !small && <span class={`stage-chip st-${sq.stage}`}>{sq.stage}</span>}
                  {months > 1 && !small && <StagePips months={months} done={sq.hold + 1} />}
                </>
              )}
              {cross?.pick === i && (
                <span class="hybrid-preview" aria-hidden="true">
                  <Mushroom species={cross.hybrid} size={100} />
                </span>
              )}
              {cross && isTarget && (
                <span class="sq-tag" aria-hidden="true">
                  {cross.pick === i ? name(cross.hybrid) : name(sq.species!)}
                </span>
              )}
              {marks?.[i] && <span class="mark-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The compost pile: discarded specimens waiting to rot into a Compost tile overnight. */
function CompostPile({ g }: { g: GameState }) {
  const per = content.rules.scrapsPerCompost;
  const n = g.compostPile.length;
  const label =
    n === 0
      ? 'Compost pile is empty'
      : `Compost pile: ${n} scrap${n === 1 ? '' : 's'}. ${n >= per ? 'A Compost tile will be ready by morning.' : `${per - n} more to make a Compost tile.`}`;
  return (
    <span class={`pile ${n >= per ? 'ready' : ''}`} title={label} aria-label={label} role="img">
      <Icon name="pile" size={16} />
      {n < per ? `${n}/${per}` : n}
    </span>
  );
}

const SHED_ORDER: Substrate[] = ['log', 'straw', 'woodchip', 'compost'];

function Tray({
  g,
  mode,
  onSpecimen,
  onShed,
  onIdentify,
  onCompostAll,
}: {
  g: GameState;
  mode: Mode;
  onSpecimen: (s: Specimen) => void;
  onShed: (i: number) => void;
  onIdentify: () => void;
  onCompostAll: () => void;
}) {
  const cap = basketCapacity(g);
  const unknown = g.basket.filter((b) => !b.identified).length;
  const shedKinds = SHED_ORDER.map((sub) => [sub, g.shed.filter((x) => x === sub).length] as const).filter(([, n]) => n > 0);
  // Composting the whole basket asks for a second tap; any change to the basket takes the question back.
  const [sure, setSure] = useState(false);
  useEffect(() => setSure(false), [g.basket.length]);
  return (
    <div class="tray">
      <div class="tray-group">
        <div class="tray-label">
          <Icon name="basket" size={16} /> Basket {g.basket.length}/{cap}
          <span class="tray-pills">
            {unknown > 0 && (
              <button class="id-all" disabled={g.actionsLeft < 1 || !!g.finale} onClick={onIdentify} aria-label={`Identify ${unknown} specimen${unknown === 1 ? '' : 's'}, 1 action`}>
                Identify {unknown}
              </button>
            )}
            {g.basket.length > 0 && (
              <button
                class={`compost-all ${sure ? 'sure' : ''}`}
                onClick={() => (sure ? onCompostAll() : setSure(true))}
                aria-label={sure ? `Tap again to compost all ${g.basket.length} specimens` : 'Compost everything in the basket, free'}
              >
                {sure ? 'Tap again' : 'Compost all'}
              </button>
            )}
          </span>
        </div>
        <div class={`slots basket-slots ${cap > 4 ? 'many' : ''}`}>
          {Array.from({ length: cap }, (_, i) => {
            const spec = g.basket[i];
            if (!spec) return <span class="slot empty" />;
            const sel = mode.kind === 'plant' && mode.uid === spec.uid;
            return (
              <button
                class={`slot ${spec.identified ? 'known' : 'unknown'} ${sel ? 'sel' : ''}`}
                onClick={() => onSpecimen(spec)}
                aria-label={spec.identified ? name(spec.species) : `Unidentified ${content.species[spec.species].group}`}
              >
                {spec.identified ? <Mushroom species={spec.species} size={40} /> : <Unknown species={spec.species} size={40} />}
              </button>
            );
          })}
        </div>
      </div>
      <div class="tray-group shed">
        <div class="tray-label">
          <Icon name="shed" size={16} /> Shed
          <CompostPile g={g} />
        </div>
        {/* One slot per kind of tile with a count, so a full shed still fits the tray. */}
        <div class="slots shed-slots" style={{ '--kinds': Math.max(shedKinds.length, 1) }}>
          {g.shed.length === 0 && <span class="muted small">empty</span>}
          {shedKinds.map(([sub, n]) => (
            <button
              class={`slot sub ${mode.kind === 'substrate' && g.shed[mode.index] === sub ? 'sel' : ''}`}
              onClick={() => onShed(g.shed.indexOf(sub))}
              aria-label={`${n} ${substrateName[sub]} tile${n === 1 ? '' : 's'}: tap, then tap empty ground`}
            >
              <SubstrateArt substrate={sub} size={40} />
              {n > 1 && <span class="shed-count">×{n}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Clears a bed and its tile onto the compost pile, so the square can take a fresh tile. Asks for a second tap. */
function CompostSquare({ g, i, store, onClose }: { g: GameState; i: number; store: Store; onClose: () => void }) {
  const [sure, setSure] = useState(false);
  const sq = g.grid[i];
  const what = sq.species ? `${name(sq.species)} and its ${substrateName[sq.substrate!]}` : `the ${substrateName[sq.substrate!]}`;
  return (
    <>
      <button
        class={`btn wide compost-square ${sure ? 'warn' : ''}`}
        disabled={g.actionsLeft < 1 || !!g.finale}
        onClick={() => (sure ? store.act({ type: 'compostSquare', square: i }) && onClose() : setSure(true))}
      >
        {sure ? `Tap again to compost ${what}` : 'Compost this square · 1 action'}
      </button>
      <p class="small muted">
        {sq.species ? 'The bed and its tile' : 'The tile'} go on the compost pile and the square becomes empty ground, ready for a new tile from your shed.
      </p>
    </>
  );
}

/** Re-pitches the grow tent over this square, once it's pitched somewhere else. */
function MoveTent({ g, i, store, onClose }: { g: GameState; i: number; store: Store; onClose: () => void }) {
  if (!g.tentPlaced || g.grid[i].tent) return null;
  return (
    <button class="btn wide" disabled={g.actionsLeft < 1 || !!g.finale} onClick={() => store.act({ type: 'moveTent', square: i }) && onClose()}>
      <Icon name="tent" /> Move the grow tent here · 1 action
    </button>
  );
}

function BedSheet({ g, i, store, onClose }: { g: GameState; i: number; store: Store; onClose: () => void }) {
  const sq = g.grid[i];
  if (sq.tree)
    return (
      <SheetFrame title="Tree" onClose={onClose}>
        <p>You can't plant here. A tree shades its four neighbors, and Lion's Mane and Shaggy Oyster only grow in shade.</p>
      </SheetFrame>
    );
  if (!sq.substrate && !sq.species)
    return (
      <SheetFrame title="Empty ground" onClose={onClose}>
        <p>Lay substrate here from your shed. Foraging trips turn up straw, logs and woodchip; a lookalike you identify turns into compost.</p>
        {isDamp(g, i) && <p class="note">Damp ground by the water: beds here never dry out.</p>}
      </SheetFrame>
    );
  if (!sq.species) {
    const fits = content.speciesOrder.filter((id) => content.species[id].kind === 'cultivated' && content.species[id].substrates.includes(sq.substrate!));
    return (
      <SheetFrame title={`Empty ${substrateName[sq.substrate!]}`} onClose={onClose}>
        <p>Ready to inoculate. Grows here: {fits.map(name).join(', ') || 'nothing yet'}.</p>
        {isDamp(g, i) && <p class="note">Damp ground by the water: beds here never dry out.</p>}
        {isShaded(g.grid, i, g.size) && <p class="note">In the shade of a tree.</p>}
        {sq.tent && <p class="note">Under the grow tent: ignores season and cold snaps.</p>}
        <MoveTent g={g} i={i} store={store} onClose={onClose} />
        <CompostSquare g={g} i={i} store={store} onClose={onClose} />
      </SheetFrame>
    );
  }
  const sp = content.species[sq.species];
  const season = seasonOf(g.round);
  const needs: string[] = [];
  if (!sq.tent && !inSeason(sp.id, season)) needs.push(`Out of season: it grows in ${seasonsText(sp.id).toLowerCase()}.`);
  if (sp.traits.needsShade && !isShaded(g.grid, i, g.size)) needs.push('Needs a tree beside it to grow.');
  const dryLimit = sp.traits.thirsty ? 1 : content.rules.dryMarksToBlight;
  return (
    <SheetFrame title={sp.name} onClose={onClose}>
      <div class="bed-sheet">
        <div class="plate small">
          <Mushroom species={sp.id} size={96} />
        </div>
        <div>
          <div class="stage-track" aria-label={`Stage: ${stageName[sq.stage!]}`}>
            {(['S', 'C', 'P', 'F'] as const).map((st) => {
              const months = stageLength(st, sp.growth);
              return (
                <span class={`stage-step ${st === sq.stage ? 'now' : ''} ${months === 0 ? 'skip' : ''}`}>
                  <b>{st}</b>
                  <small>{stageName[st]}</small>
                  {months > 1 && <StagePips months={months} done={st === sq.stage ? sq.hold + 1 : 0} />}
                </span>
              );
            })}
          </div>
          {sq.stage !== 'F' && <p class="stage-note">{stageProgress(sq.stage!, sq.hold, sp.growth)}</p>}
          <dl class="meta">
            <dt>Substrate</dt>
            <dd>{substrateName[sq.substrate!]}</dd>
            <dt>Season</dt>
            <dd>{seasonsText(sp.id)}</dd>
            <dt>Growth</dt>
            <dd>{growthName[sp.growth]}</dd>
            <dt>Value</dt>
            <dd>
              {sp.value} coin{sp.value === 1 ? '' : 's'}
            </dd>
            <dt>Dry marks</dt>
            <dd>
              {isDamp(g, i) ? 'Never (damp ground)' : g.gear.includes('dripline') ? 'Never (drip line)' : `${sq.dry} of ${dryLimit}`}
            </dd>
          </dl>
        </div>
      </div>
      <p class="rule">{sp.rule}</p>
      {needs.map((n) => (
        <p class="note warn">{n}</p>
      ))}
      {sq.tent && <p class="note">Under the grow tent: ignores season and cold snaps.</p>}
      {sq.blight ? (
        <>
          <p class="note warn">Blighted: it won't grow or fruit, and blight spreads to neighbors of the same species.</p>
          <button
            class="btn primary wide"
            disabled={g.actionsLeft < 1 || !!g.finale}
            onClick={() => store.act({ type: 'clearBlight', square: i }) && onClose()}
          >
            {g.gear.includes('blightspray') && g.grid.filter((x) => x.blight).length > 1
              ? `Spray all ${g.grid.filter((x) => x.blight).length} blighted beds · 1 action`
              : 'Clear blight · 1 action'}
          </button>
        </>
      ) : sq.stage === 'F' ? (
        <button
          class="btn primary wide"
          disabled={g.finale ? g.finale.harvested : g.actionsLeft < 1}
          onClick={() => store.act({ type: 'harvest' }) && onClose()}
        >
          {g.finale ? 'Bring in the last harvest' : 'Harvest every fruiting bed · 1 action'}
        </button>
      ) : null}
      <MoveTent g={g} i={i} store={store} onClose={onClose} />
      <CompostSquare g={g} i={i} store={store} onClose={onClose} />
    </SheetFrame>
  );
}

/** One dot per growing month a stage takes, filled up to the month the bed is in. */
function StagePips({ months, done }: { months: number; done: number }) {
  return (
    <span class="stage-pips" aria-hidden="true">
      {Array.from({ length: months }, (_, k) => (
        <i class={k < done ? 'on' : ''} />
      ))}
    </span>
  );
}

function stageProgress(stage: Stage, hold: number, rate: GrowthRate) {
  const months = stageLength(stage, rate);
  const left = months - hold;
  const next = stage === 'S' ? 'Colonizes' : stage === 'C' && rate !== 'fast' ? 'Pins' : 'Fruits';
  const at = months > 1 ? `Month ${hold + 1} of ${months} ${stage === 'C' ? 'colonizing' : 'pinning'}. ` : '';
  return `${at}${next} after ${left === 1 ? 'the next growing month' : `${left} more growing months`}.`;
}

function CompostHint() {
  return (
    <p class="small muted">
      Composted specimens go on the pile beside your shed. Every {content.rules.scrapsPerCompost} rot into a Compost tile overnight.
    </p>
  );
}

function SpecimenSheet({
  g,
  uid,
  store,
  onClose,
  onPlant,
  onReveal,
}: {
  g: GameState;
  uid: number;
  store: Store;
  onClose: () => void;
  onPlant: (uid: number) => void;
  onReveal: (r: ActionResult) => void;
}) {
  const spec = g.basket.find((b) => b.uid === uid);
  if (!spec) return null;
  const sp = content.species[spec.species];
  const guide = g.gear.includes('fieldguide');
  const bad = lookalikeOn(g, sp.id);
  const risk = guide ? (bad / 6) ** 2 : bad / 6;
  const spots = plantableSquares(g, spec.species);
  const unknownCount = g.basket.filter((b) => !b.identified).length;
  if (!spec.identified)
    return (
      <SheetFrame title={`${sp.group}?`} onClose={onClose}>
        <div class="bed-sheet">
          <div class="plate small">
            <Unknown species={sp.id} size={96} />
          </div>
          <div>
            <p>
              An unidentified specimen from the {sp.group?.toLowerCase()} group. It might be the real thing, or a lookalike.
              {unknownCount > 1 ? ` Identifying checks all ${unknownCount} unknown specimens in your basket at once.` : ''}
            </p>
            <p class="small muted">
              Lookalike chance: {Math.round(risk * 100)}%{guide ? ' with your Field Guide' : ''}
              {masteryOf(g, sp.id) >= 1 ? `, and you're ${masteryName(masteryOf(g, sp.id)).toLowerCase()} with ${sp.name}` : ''}. A lookalike becomes
              compost.
            </p>
          </div>
        </div>
        <div class="row">
          <button
            class="btn primary grow"
            disabled={g.actionsLeft < 1 || !!g.finale}
            onClick={() => {
              const r = store.act({ type: 'identify' });
              if (r) onReveal(r);
            }}
          >
            {unknownCount > 1 ? `Identify all ${unknownCount} · 1 action` : 'Identify · 1 action'}
          </button>
          <button class="btn ghost" onClick={() => store.act({ type: 'discard', uid }) && onClose()}>
            Compost it
          </button>
        </div>
        <CompostHint />
      </SheetFrame>
    );
  return (
    <SheetFrame title={sp.name} onClose={onClose}>
      <div class="bed-sheet">
        <div class="plate small">
          <Mushroom species={sp.id} size={96} />
        </div>
        <div>
          <p class="rule">{sp.rule}</p>
          <p class="small muted">
            {substrateName[sp.substrates[0]]} · {seasonsText(sp.id)} · {growthName[sp.growth]}
          </p>
        </div>
      </div>
      {spots.length === 0 && (
        <p class="note warn">No empty {sp.substrates.map((x) => substrateName[x]).join(' or ')} square. Lay one from your shed, or find one in the forest.</p>
      )}
      <div class="row">
        <button class="btn primary grow" disabled={!spots.length || g.actionsLeft < 1} onClick={() => onPlant(uid)}>
          Plant · 1 action
        </button>
        <button class="btn ghost" onClick={() => store.act({ type: 'discard', uid }) && onClose()}>
          Compost it
        </button>
      </div>
      <CompostHint />
    </SheetFrame>
  );
}

function Reveal({ r, g, onDone, onPlant }: { r: ActionResult & { kind: 'identify' }; g: GameState; onDone: () => void; onPlant: (uid: number) => void }) {
  const many = r.results.length > 1;
  const [flipped, setFlipped] = useState(0);
  // Cards turn one after another, so each find gets its own small moment.
  useEffect(() => {
    if (flipped >= r.results.length) return;
    const t = setTimeout(() => setFlipped((n) => n + 1), flipped === 0 ? 650 : 380);
    return () => clearTimeout(t);
  }, [flipped, r.results.length]);
  const done = flipped >= r.results.length;
  const canPlant = (x: IdentifyResult) =>
    x.real && content.species[x.species].kind === 'cultivated' && g.basket.some((b) => b.uid === x.uid) && plantableSquares(g, x.species).length > 0 && g.actionsLeft > 0;
  const real = r.results.filter((x) => x.real);
  const fakes = r.results.length - real.length;
  const wild = real.filter((x) => content.species[x.species].kind === 'wild').length;
  const plantable = r.results.filter(canPlant);
  const art = many ? 84 : 170;

  return (
    <div class={`overlay reveal ${many ? 'many' : ''}`}>
      <div class="reveal-grid" style={{ '--count': r.results.length === 4 ? 2 : Math.min(r.results.length, 3) } as any}>
        {r.results.map((x, i) => {
          const sp = content.species[x.species];
          const up = i < flipped;
          const tappable = up && done && canPlant(x);
          return (
            <div class="reveal-card">
              <button
                class={`flip ${up ? 'flipped' : ''} ${tappable ? 'plantable' : ''}`}
                disabled={!tappable}
                onClick={() => onPlant(x.uid)}
                aria-label={up ? `${x.real ? sp.name : `${sp.lookalike?.name}, a lookalike`}${tappable ? '. Tap to plant it' : ''}` : `${sp.group}, not yet revealed`}
              >
                <div class="face back paper">
                  <Unknown species={x.species} size={many ? 76 : 150} />
                  <div class="plate-name">{sp.group}</div>
                </div>
                <div class={`face front paper ${x.real ? 'real' : 'fake'}`}>
                  {x.real ? <Mushroom species={x.species} size={art} /> : <Unknown species={x.species} size={many ? 76 : 150} lookalike />}
                  {!x.real && <span class="stamp">Lookalike</span>}
                  <div class="plate-name">{x.real ? sp.name : sp.lookalike?.name}</div>
                  {!many && <div class="plate-latin">{x.real ? sp.latin : `a ${sp.name} lookalike`}</div>}
                </div>
              </button>
              <div class={`dice ${up ? 'show' : ''}`}>
                {x.rolls.map((d) => (
                  <span class={`die ${d === x.kept ? 'kept' : ''}`}>{d}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div class={`reveal-text ${done ? 'show' : ''}`}>
        {many ? (
          <p>
            {real.length} real{fakes ? `, ${fakes} lookalike${fakes === 1 ? '' : 's'}` : ''}.{wild ? ` Wild finds went straight to storage.` : ''}
            {fakes ? ` Lookalikes rot down into Compost tiles in your shed.` : ''}
            {plantable.length ? ' Tap a mushroom to plant it now.' : ''}
          </p>
        ) : real.length ? (
          <p>
            The real thing.{' '}
            {wild
              ? 'It goes straight into storage to sell or deliver.'
              : 'Plant it on ' + content.species[real[0].species].substrates.map((x) => substrateName[x]).join(' or ') + '.'}
          </p>
        ) : (
          <p>A lookalike. Not a loss: it rots down into a Compost tile in your shed.</p>
        )}
        <div class="row center">
          {!many && plantable.length > 0 && (
            <button class="btn primary" onClick={() => onPlant(plantable[0].uid)}>
              Plant it
            </button>
          )}
          <button class={`btn ${!many && plantable.length ? 'ghost' : 'primary'}`} onClick={onDone}>
            {!many && plantable.length ? 'Later' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TendSheet({ g, store, onClose, onBed }: { g: GameState; store: Store; onClose: () => void; onBed: (i: number) => void }) {
  const blighted = g.grid.map((_, i) => i).filter((i) => g.grid[i].blight);
  const dry = g.grid.filter((sq, i) => sq.species && !isDamp(g, i)).length;
  // Beds whose season won't come round again before the festival.
  const spent = g.grid
    .map((_, i) => i)
    .filter((i) => {
      const sq = g.grid[i];
      if (!sq.species || sq.tent) return false;
      for (let r = g.round; r <= content.rules.rounds; r++) if (inSeason(sq.species, seasonOf(r))) return false;
      return true;
    });
  // Beds the tent would wake up: out of season this month and not already fruiting.
  const waiting = g.grid
    .map((_, i) => i)
    .filter((i) => {
      const sq = g.grid[i];
      return sq.species && !sq.tent && sq.stage !== 'F' && !inSeason(sq.species, seasonOf(g.round));
    });
  return (
    <SheetFrame title="Tend the farm" onClose={onClose}>
      {g.gear.includes('dripline') ? (
        <p class="note">
          <Icon name="water" size={16} /> Your Drip Line waters every bed each night, dry spell or not.
        </p>
      ) : (
        <button class="btn primary wide" disabled={g.watered || g.actionsLeft < 1} onClick={() => store.act({ type: 'water' }) && onClose()}>
          <Icon name="water" /> {g.watered ? 'Watered this month' : 'Water every bed · 1 action'}
        </button>
      )}
      {!g.gear.includes('dripline') && (
        <p class="small muted">
          {mealEffect(g)?.type === 'water'
            ? 'The neighbors will water the beds on their way home from supper.'
            : g.weather === 'rain'
              ? 'Rain is watering everything this month already.'
              : g.weather === 'dryspell'
                ? 'Dry spell: nothing grows this month unless you water.'
                : `${dry} bed${dry === 1 ? '' : 's'} away from water will take a dry mark tonight if you don't water.`}
        </p>
      )}
      <h3>Blight</h3>
      {blighted.length === 0 ? (
        <p class="muted">No blight. The farm looks healthy.</p>
      ) : g.gear.includes('blightspray') && blighted.length > 1 ? (
        <button
          class="btn primary wide"
          disabled={g.actionsLeft < 1}
          onClick={() => store.act({ type: 'clearBlight', square: blighted[0] }) && onClose()}
        >
          <Icon name="blight" /> Spray all {blighted.length} blighted beds · 1 action
        </button>
      ) : (
        <ul class="list">
          {blighted.map((i) => (
            <li>
              <button class="list-btn" onClick={() => onBed(i)}>
                <Icon name="blight" /> {name(g.grid[i].species!)} · {squareName(i, g.size)}
              </button>
            </li>
          ))}
        </ul>
      )}
      {g.tentPlaced && (
        <>
          <h3>Grow tent</h3>
          <p class="small muted">
            It's pitched on {squareName(g.grid.findIndex((sq) => sq.tent), g.size)}. Tap any bed or tile on the farm to move it there for 1 action.
          </p>
          {waiting.length > 0 && (
            <ul class="list">
              {waiting.map((i) => (
                <li>
                  <button class="list-btn" onClick={() => onBed(i)}>
                    <Icon name="tent" /> {name(g.grid[i].species!)} · {squareName(i, g.size)} · {spent.includes(i) ? 'season over for the year' : 'out of season now'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <h3>Compost a square</h3>
      <p class="small muted">Tap any bed or tile on the farm to compost it and free the square for a new tile.</p>
      {spent.length > 0 && (
        <ul class="list">
          {spent.map((i) => (
            <li>
              <button class="list-btn" onClick={() => onBed(i)}>
                <Icon name="pile" /> {name(g.grid[i].species!)} · {squareName(i, g.size)} · season over for the year
              </button>
            </li>
          ))}
        </ul>
      )}
    </SheetFrame>
  );
}

function Menu({
  g,
  onClose,
  onHelp,
  onTitle,
  onAlmanac,
}: {
  g: GameState;
  onClose: () => void;
  onHelp: () => void;
  onTitle: () => void;
  onAlmanac: () => void;
}) {
  return (
    <SheetFrame title="Underbrush" onClose={onClose}>
      <p class="small muted">
        {g.mode === 'daily' ? 'Daily year' : 'Story year'} · saved after every action
      </p>
      <div class="col">
        <button class="btn" onClick={onHelp}>
          How to play
        </button>
        <button class="btn" onClick={onAlmanac}>
          Almanac: homestead and mastery
        </button>
        <button class="btn" onClick={onTitle}>
          Save and return to title
        </button>
      </div>
      <p class="disclaimer">Underbrush is a game, not a foraging guide. Never eat a wild mushroom because of anything you saw here.</p>
    </SheetFrame>
  );
}

/** A few petals, leaves or snowflakes drifting over the farm, by season. Summer stays still. */
function Weathering({ season }: { season: string }) {
  if (season === 'summer') return null;
  return (
    <div class={`weathering ${season}`} aria-hidden="true">
      {Array.from({ length: 7 }, (_, i) => (
        <span style={{ '--i': i } as any} />
      ))}
    </div>
  );
}

export function Game({
  store,
  onHelp,
  onTitle,
  onNewYear,
  onAlmanac,
}: {
  store: Store;
  onHelp: () => void;
  onTitle: () => void;
  onNewYear: () => void;
  onAlmanac: () => void;
}) {
  const g = store.game!;
  const [mode, setMode] = useState<Mode>({ kind: 'none' });
  const [sheet, setSheet] = useState<Sheet>(null);
  const [reveal, setReveal] = useState<(ActionResult & { kind: 'identify' }) | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);

  useEffect(() => {
    if (!confirmEnd) return;
    const t = setTimeout(() => setConfirmEnd(false), 2600);
    return () => clearTimeout(t);
  }, [confirmEnd]);

  // Leaving plant or placement mode when its subject disappears (e.g. after planting).
  useEffect(() => {
    if (mode.kind === 'plant' && !g.basket.some((b) => b.uid === mode.uid)) setMode({ kind: 'none' });
    if (mode.kind === 'substrate' && !g.shed[mode.index]) setMode({ kind: 'none' });
    if (mode.kind === 'tent' && g.tentPlaced) setMode({ kind: 'none' });
  }, [g, mode]);

  const needTent = g.gear.includes('growtent') && !g.tentPlaced;
  const ready = g.grid.filter((sq) => sq.stage === 'F' && !sq.blight && sq.species).length;
  const blighted = g.grid.filter((sq) => sq.blight).length;
  const busy = !!g.night || g.pendingCrosses.length > 0;

  const onSquare = (i: number) => {
    if (mode.kind === 'plant') {
      const spec = g.basket.find((b) => b.uid === mode.uid);
      if (spec && canPlantOn(g, spec.species, i)) store.act({ type: 'plant', uid: mode.uid, square: i });
      return;
    }
    if (mode.kind === 'substrate') {
      store.act({ type: 'placeSubstrate', index: mode.index, square: i });
      setMode({ kind: 'none' });
      return;
    }
    if (mode.kind === 'tent') {
      store.act({ type: 'placeTent', square: i });
      return;
    }
    setSheet({ kind: 'bed', i });
  };

  const startPlant = (uid: number) => {
    setSheet(null);
    setReveal(null);
    setMode({ kind: 'plant', uid });
  };

  const finale = g.finale;
  // On festival morning, skipping the last harvest or market visit asks for a second tap, like resting with actions left.
  const finaleUnused = !!finale && (!finale.marketed || (ready > 0 && !finale.harvested));
  const endMonth = () => {
    if ((finale ? finaleUnused : g.actionsLeft > 0) && !confirmEnd) {
      setConfirmEnd(true);
      return;
    }
    setConfirmEnd(false);
    setMode({ kind: 'none' });
    store.act(finale ? { type: 'festival' } : { type: 'endMonth' });
  };

  if (g.over && !g.night) return <YearEnd store={store} onTitle={onTitle} onNewYear={onNewYear} />;

  const plantSpec = mode.kind === 'plant' ? g.basket.find((b) => b.uid === mode.uid) : null;
  const banner =
    mode.kind === 'plant' && plantSpec
      ? `Tap an empty ${content.species[plantSpec.species].substrates.map((x) => substrateName[x]).join(' or ')} square for ${name(plantSpec.species)}`
      : mode.kind === 'substrate'
        ? `Tap empty ground to lay the ${substrateName[g.shed[mode.index]]?.toLowerCase()}`
        : mode.kind === 'tent'
          ? 'Tap a square to pitch your grow tent'
          : null;

  return (
    <div class={`game season-${g.finale ? 'winter' : seasonOf(g.round)}`}>
      <Weathering season={g.finale ? 'winter' : seasonOf(g.round)} />
      <Hud
        g={g}
        onWeather={() => setSheet({ kind: 'weather' })}
        onPantry={() => setSheet({ kind: 'pantry' })}
        onMenu={() => setSheet({ kind: 'menu' })}
      />
      <Orders g={g} onOpen={() => setSheet({ kind: 'market' })} />

      <main class="farm-area">
        {banner ? (
          <div class="banner">
            <span>{banner}</span>
            {mode.kind !== 'tent' && (
              <button class="btn small ghost" onClick={() => setMode({ kind: 'none' })}>
                Cancel
              </button>
            )}
          </div>
        ) : needTent ? (
          <div class="banner">
            <span>Your grow tent is ready to pitch.</span>
            <button class="btn small primary" onClick={() => setMode({ kind: 'tent' })}>
              Pitch it
            </button>
          </div>
        ) : finale ? (
          <div class="banner festival">
            <span>
              {finale.harvested && finale.marketed
                ? 'All done. The village is waiting at the festival.'
                : `Before the festival: ${[!finale.harvested && 'one last harvest', !finale.marketed && 'one market visit'].filter(Boolean).join(' and ')}, no actions needed.`}
            </span>
          </div>
        ) : (
          <div class="banner quiet">
            <ActionsPips left={g.actionsLeft} total={actionsPerMonth(g)} />
            <span class="small">
              {g.actionsLeft > 0 ? `${g.actionsLeft} action${g.actionsLeft === 1 ? '' : 's'} left this month` : 'No actions left. Time to rest.'}
            </span>
          </div>
        )}
        <Farm g={g} mode={mode} onSquare={onSquare} />
      </main>

      <Tray
        g={g}
        mode={mode}
        onSpecimen={(s) => (mode.kind === 'plant' && mode.uid === s.uid ? setMode({ kind: 'none' }) : setSheet({ kind: 'specimen', uid: s.uid }))}
        onShed={(i) => setMode(mode.kind === 'substrate' && mode.index === i ? { kind: 'none' } : { kind: 'substrate', index: i })}
        onIdentify={() => {
          const r = store.act({ type: 'identify' });
          if (r?.kind === 'identify') setReveal(r);
        }}
        onCompostAll={() => {
          store.act({ type: 'compostBasket' });
          if (mode.kind === 'plant') setMode({ kind: 'none' });
        }}
      />

      <nav class="actions" aria-label="Actions">
        <button class="act" disabled={g.actionsLeft < 1 || !!finale} onClick={() => setSheet({ kind: 'forage' })}>
          <Icon name="forage" size={26} />
          <span>Forage</span>
        </button>
        <button class="act" disabled={!!finale} onClick={() => setSheet({ kind: 'tend' })}>
          <Icon name="tend" size={26} />
          <span>Tend</span>
          {blighted > 0 && <span class="badge warn">{blighted}</span>}
        </button>
        <button class="act" disabled={!ready || (finale ? finale.harvested : g.actionsLeft < 1)} onClick={() => store.act({ type: 'harvest' })}>
          <Icon name="harvest" size={26} />
          <span>Harvest</span>
          {ready > 0 && <span class="badge">{ready}</span>}
        </button>
        <button class="act" onClick={() => setSheet({ kind: 'market' })}>
          <Icon name="market" size={26} />
          <span>Market</span>
          {g.market && <span class="badge open">open</span>}
        </button>
        <button
          class={`act end ${finale ? 'festival' : ''} ${(finale ? !finaleUnused : g.actionsLeft === 0) ? 'glow' : ''} ${confirmEnd ? 'confirm' : ''}`}
          onClick={endMonth}
        >
          <Icon name={finale ? 'spark' : 'moon'} size={26} />
          <span>{confirmEnd ? (finale ? 'Tap to go' : 'Tap to rest') : finale ? 'Festival' : 'End month'}</span>
        </button>
      </nav>

      {sheet?.kind === 'bed' && <BedSheet g={g} i={sheet.i} store={store} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'specimen' && (
        <SpecimenSheet
          g={g}
          uid={sheet.uid}
          store={store}
          onClose={() => setSheet(null)}
          onPlant={startPlant}
          onReveal={(r) => {
            setSheet(null);
            if (r.kind === 'identify') setReveal(r);
          }}
        />
      )}
      {sheet?.kind === 'tend' && <TendSheet g={g} store={store} onClose={() => setSheet(null)} onBed={(i) => setSheet({ kind: 'bed', i })} />}
      {sheet?.kind === 'weather' && (
        <SheetFrame title={content.weather.find((w) => w.id === g.weather)!.name} onClose={() => setSheet(null)}>
          <p>{content.weather.find((w) => w.id === g.weather)!.rule}</p>
          <p class="small muted">A new weather card turns over every month.</p>
        </SheetFrame>
      )}
      {sheet?.kind === 'menu' && <Menu g={g} onClose={() => setSheet(null)} onHelp={onHelp} onTitle={onTitle} onAlmanac={onAlmanac} />}
      {sheet?.kind === 'market' && <Market g={g} store={store} onClose={() => setSheet(null)} onPantry={() => setSheet({ kind: 'pantry' })} />}
      {sheet?.kind === 'pantry' && <Pantry g={g} store={store} onClose={() => setSheet(null)} />}
      {(sheet?.kind === 'forage' || g.forage) && <Forage g={g} store={store} onClose={() => setSheet(null)} />}
      {reveal && <Reveal r={reveal} g={g} onDone={() => setReveal(null)} onPlant={startPlant} />}
      {busy && <Night g={g} store={store} />}
      {store.error && (
        <div class="toast" role="alert" onClick={store.clearError}>
          {store.error}
        </div>
      )}
    </div>
  );
}
