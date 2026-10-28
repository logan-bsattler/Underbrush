import { useState } from 'preact/hooks';
import { content, type YearRecord } from '../core';
import type { Store } from './store';
import { name } from './text';
import { ScoreTable } from './YearEnd';

const tierName = (id: string | null) => (id ? content.rules.tiers.find((t) => t.id === id)?.name ?? id : 'A quiet year');
const levelTitle = (n: number) => content.progression.levels.find((l) => l.level === n)?.title ?? `Level ${n}`;
const orderName = (id: string) => content.orders.find((o) => o.id === id)?.label ?? id;
const challengeName = (id: string) => content.progression.challenges.find((x) => x.id === id)?.name ?? id;

function yearName(y: YearRecord) {
  const mode = y.mode === 'daily' ? `Daily ${y.seed.replace(/^daily-/, '')}` : 'Story year';
  const board = y.board && content.boards.find((b) => b.id === y.board)?.name;
  return board ? `${mode} on ${board}` : mode;
}

/** Every festival the homestead has finished, newest first, each opening in place to its score card. */
export function PastFestivals({ store, onBack }: { store: Store; onBack: () => void }) {
  const years = store.journal.years;
  // The first year to reach the top score, matching the field journal's "best".
  const best = years.reduce<YearRecord | null>((b, y) => (!b || y.score > b.score ? y : b), null);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div class="screen history paper">
      <header class="screen-head">
        <button class="btn small ghost" onClick={onBack}>
          ← Back
        </button>
        <h1>Past festivals</h1>
      </header>
      <p class="small muted">
        {years.length} festival{years.length === 1 ? '' : 's'} finished. Tap a year to see how its points were made.
      </p>
      <ul class="festivals">
        {years
          .slice()
          .reverse()
          .map((y) => {
            const on = open === y.seed;
            return (
              <li class={`${on ? 'open' : ''} ${y === best ? 'best' : ''}`}>
                <button class="fest-row" aria-expanded={on} onClick={() => setOpen(on ? null : y.seed)}>
                  <span class="fest-score">{y.score}</span>
                  <span class="fest-body">
                    <b>
                      {tierName(y.tier)}
                      {y === best && <span class="fest-best"> · best</span>}
                    </b>
                    <small class="muted">
                      {new Date(y.finished).toLocaleDateString()} · {yearName(y)}
                      {(y.generation ?? 1) > 1 && ` · generation ${y.generation}`}
                    </small>
                  </span>
                  <span class="fest-chev" aria-hidden="true">
                    {on ? '▴' : '▾'}
                  </span>
                </button>
                {on && <FestivalDetail y={y} />}
              </li>
            );
          })}
      </ul>
    </div>
  );
}

export function FestivalDetail({ y }: { y: YearRecord }) {
  return (
    <div class="fest-detail">
      <p class="small">
        +{y.renown} renown ·{' '}
        {y.levelTo > y.levelFrom
          ? `${levelTitle(y.levelFrom)} (level ${y.levelFrom}) to ${levelTitle(y.levelTo)} (level ${y.levelTo})`
          : `${levelTitle(y.levelFrom)}, level ${y.levelFrom}`}
      </p>
      {y.masteryUps.length > 0 && <p class="small">Mastery grew: {y.masteryUps.map(name).join(', ')}</p>}
      {y.breakdown ? (
        <>
          <ScoreTable sc={y.breakdown} total={y.score} orders={y.orders?.length ?? 0} hybrids={y.hybrids ?? []} artifacts={y.artifacts ?? []} />
          {y.orders && y.orders.length > 0 && <p class="small">Orders: {y.orders.map(orderName).join(', ')}</p>}
          {y.challenges && y.challenges.length > 0 && <p class="small">Challenges: {y.challenges.map(challengeName).join(', ')}</p>}
        </>
      ) : (
        <p class="small muted">Recorded before the full score card was kept.</p>
      )}
    </div>
  );
}
