import { content, type GameState, type NightEvent } from '../core';
import { Icon, Mushroom } from './art';
import { Farm } from './Game';
import type { Store } from './store';
import { eventText, name, waitText, weekLabel } from './text';

const markFor: Partial<Record<NightEvent['type'], string>> = {
  grow: 'grow',
  blight: 'blight',
  spread: 'spread',
  takeover: 'blight',
  overripe: 'blight',
  cross: 'cross',
};

export function Night({ g, store }: { g: GameState; store: Store }) {
  const report = g.night;
  const cross = g.pendingCrosses[0];

  if (!report && cross) return <CrossPrompt g={g} store={store} />;
  if (!report) return null;

  const marks: Record<number, string> = {};
  for (const e of report.events) {
    const t = markFor[e.type];
    if (!t) continue;
    const sq = 'square' in e ? e.square : 'to' in e && typeof e.to === 'number' ? e.to : 'a' in e ? e.a : null;
    if (sq !== null && (marks[sq] !== 'blight' || t === 'blight')) marks[sq] = t;
  }

  const lines = report.events.map((e) => eventText(e, g.grid)).filter((x): x is string => !!x);
  const waits: Record<string, number> = {};
  for (const e of report.events) if (e.type === 'wait' && e.reason !== 'slow') waits[e.reason] = (waits[e.reason] ?? 0) + 1;
  const grew = report.events.filter((e) => e.type === 'grow').length;
  const dried = report.events.filter((e) => e.type === 'dry').length;
  const weather = content.weather.find((w) => w.id === g.weather)!;

  return (
    <div class="overlay night">
      <div class="stars" aria-hidden="true" />
      <header class="night-head">
        <Icon name="moon" size={34} />
        <div>
          <div class="eyebrow">Night falls on week {report.round}</div>
          <h2>The farm grows while you sleep</h2>
        </div>
      </header>
      <Farm g={g} marks={marks} small />
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
      {g.over ? (
        <footer class="morning">
          <p>The year is done. Tomorrow is the Harvest Festival.</p>
          <button class="btn primary big wide" onClick={() => store.act({ type: 'dismissNight' })}>
            Go to the festival
          </button>
        </footer>
      ) : (
        <footer class="morning">
          <div class="weather-card">
            <Icon name={weather.id} size={40} />
            <div>
              <div class="eyebrow">
                Week {g.round} · {weekLabel(g.round)}
              </div>
              <b>{weather.name}.</b> {weather.rule}
            </div>
          </div>
          {g.moldPenalty > 0 && <p class="note warn">Mold bloom: only {g.actionsLeft} actions this week.</p>}
          <button class="btn primary big wide" onClick={() => store.act({ type: 'dismissNight' })}>
            {g.pendingCrosses.length ? 'See what crossed' : 'Start the week'}
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
  return (
    <div class="overlay cross">
      <div class="cross-card paper">
        <div class="eyebrow">A hybrid is possible</div>
        <div class="cross-art">
          <Mushroom species={a} size={70} />
          <span class="times">×</span>
          <Mushroom species={b} size={70} />
          <span class="times">=</span>
          <Mushroom species={x.hybrid} size={96} />
        </div>
        <h2>{h.name}</h2>
        <p>
          {name(a)} and {name(b)} grew side by side and their mycelium met. One bed can turn into {h.name}: worth {h.value}, and{' '}
          {content.rules.hybridPoints} festival points the first time you make it.
        </p>
        <p class="rule">{h.rule}</p>
        <div class="col">
          <button class="btn primary" onClick={() => store.act({ type: 'resolveCross', index: 0, replace: 'a' })}>
            Turn the {name(a)} bed into {h.name}
          </button>
          <button class="btn primary" onClick={() => store.act({ type: 'resolveCross', index: 0, replace: 'b' })}>
            Turn the {name(b)} bed into {h.name}
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
