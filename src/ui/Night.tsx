import { useState } from 'preact/hooks';
import { content, type GameState, type NightEvent } from '../core';
import { Icon, Mushroom } from './art';
import { Farm } from './Game';
import type { Store } from './store';
import { eventText, name, squareName, waitText, monthLabel } from './text';

const markFor: Partial<Record<NightEvent['type'], string>> = {
  grow: 'grow',
  blight: 'blight',
  spread: 'spread',
  feed: 'grow',
  takeover: 'blight',
  overripe: 'blight',
  cross: 'cross',
};

export function Night({ g, store }: { g: GameState; store: Store }) {
  const report = g.night;
  const cross = g.pendingCrosses[0];

  if (!report && cross) return <CrossPrompt key={`${cross.a}-${cross.b}-${cross.hybrid}`} g={g} store={store} />;
  if (!report) return null;

  const marks: Record<number, string> = {};
  for (const e of report.events) {
    const t = markFor[e.type];
    if (!t) continue;
    const sq = 'square' in e ? e.square : 'to' in e && typeof e.to === 'number' ? e.to : 'a' in e ? e.a : null;
    if (sq !== null && (marks[sq] !== 'blight' || t === 'blight')) marks[sq] = t;
  }

  // The apprentice's pick plays over the farm: each bed's mushroom lifts out in turn.
  const auto = report.events.find((e) => e.type === 'autoHarvest');
  const lines = report.events
    .map((e) => eventText(e, g.grid, { picked: auto?.squares, finale: !!g.finale }))
    .filter((x): x is string => !!x);
  const waits: Record<string, number> = {};
  for (const e of report.events) if (e.type === 'wait' && e.reason !== 'slow') waits[e.reason] = (waits[e.reason] ?? 0) + 1;
  const grew = report.events.filter((e) => e.type === 'grow').length;
  const dried = report.events.filter((e) => e.type === 'dry').length;
  const weather = content.weather.find((w) => w.id === g.weather)!;
  const picked = auto ? { squares: auto.squares ?? [], species: (auto.squares ?? []).map((i) => g.grid[i].species!), key: report.round } : undefined;

  return (
    <div class="overlay night">
      <div class="stars" aria-hidden="true" />
      <header class="night-head">
        <Icon name="moon" size={34} />
        <div>
          <div class="eyebrow">Night falls on month {report.round}</div>
          <h2>The farm grows while you sleep</h2>
        </div>
      </header>
      <Farm g={g} marks={marks} picked={picked} small />
      <ul class="night-log">
        <li style={{ '--i': 0 } as any}>
          {grew ? `${grew} bed${grew === 1 ? '' : 's'} grew a stage.` : 'Nothing grew tonight.'}
          {dried ? ` ${dried} took a dry mark.` : ''}
        </li>
        {Object.entries(waits).map(([r, n], i) => (
          <li style={{ '--i': i + 1 } as any} class="muted">
            {n} bed{n === 1 ? '' : 's'} waited: {waitText[r as keyof typeof waitText]}.
          </li>
        ))}
        {lines.map((l, i) => (
          <li style={{ '--i': i + 2 } as any}>{l}</li>
        ))}
      </ul>
      {g.finale ? (
        <footer class="morning">
          <div class="weather-card">
            <Icon name="spark" size={40} />
            <div>
              <div class="eyebrow">The year is done</div>
              <b>Festival morning.</b>{' '}
              {g.finale.harvested ? 'Time for a market visit before the festival.' : 'Time for one last harvest and a market visit before the festival.'}
            </div>
          </div>
          <button class="btn primary big wide" onClick={() => store.act({ type: 'dismissNight' })}>
            {g.pendingCrosses.length ? 'See what crossed' : 'Wake up for the festival'}
          </button>
        </footer>
      ) : (
        <footer class="morning">
          <div class="weather-card">
            <Icon name={weather.id} size={40} />
            <div>
              <div class="eyebrow">
                Month {g.round} · {monthLabel(g.round)}
              </div>
              <b>{weather.name}.</b> {weather.rule}
            </div>
          </div>
          {g.moldPenalty > 0 && <p class="note warn">Mold bloom: only {g.actionsLeft} actions this month.</p>}
          <button class="btn primary big wide" onClick={() => store.act({ type: 'dismissNight' })}>
            {g.pendingCrosses.length ? 'See what crossed' : 'Start the month'}
          </button>
        </footer>
      )}
    </div>
  );
}

function CrossPrompt({ g, store }: { g: GameState; store: Store }) {
  const x = g.pendingCrosses[0];
  const a = g.grid[x.a].species!;
  const b = g.grid[x.b].species!;
  const h = content.species[x.hybrid];
  const [pick, setPick] = useState<number | null>(null);
  return (
    <div class="overlay cross">
      <div class="cross-card paper">
        <header class="cross-head">
          <Mushroom species={x.hybrid} size={64} />
          <div>
            <div class="eyebrow">A hybrid is possible</div>
            <h2>{h.name}</h2>
            <div class="small muted">
              {name(a)} × {name(b)} · worth {h.value} · +{content.rules.hybridPoints} festival points the first time
            </div>
          </div>
        </header>
        <p>Their mycelium met overnight. Tap the bed that should become {h.name}.</p>
        <Farm g={g} small mode={{ kind: 'cross', a: x.a, b: x.b, hybrid: x.hybrid, pick }} onSquare={setPick} />
        <div class="cross-choices" role="group" aria-label="Bed to change">
          {([x.a, x.b] as const).map((sq) => (
            <button class={`choice ${pick === sq ? 'on' : ''}`} aria-pressed={pick === sq} onClick={() => setPick(sq)}>
              <b>{name(g.grid[sq].species!)} bed</b>
              <small>{squareName(sq, g.size)}</small>
            </button>
          ))}
        </div>
        <p class="rule small">{h.rule}</p>
        <div class="col">
          <button
            class="btn primary"
            disabled={pick === null}
            onClick={() => store.act({ type: 'resolveCross', index: 0, replace: pick === x.a ? 'a' : 'b' })}
          >
            {pick === null ? 'Tap a highlighted bed' : `Make ${h.name} on the ${name(g.grid[pick].species!)} bed`}
          </button>
          <button class="btn ghost" onClick={() => store.act({ type: 'resolveCross', index: 0, replace: null })}>
            Keep them as they are
          </button>
        </div>
        {g.pendingCrosses.length > 1 && <p class="small muted">{g.pendingCrosses.length - 1} more possible after this.</p>}
      </div>
    </div>
  );
}
