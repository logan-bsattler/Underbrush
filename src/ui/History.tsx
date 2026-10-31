import { useState } from 'preact/hooks';
import { content, dailyMonth, dailyStats, orderById, type DailyStats, type YearRecord } from '../core';
import type { Store } from './store';
import { todayKey } from './store';
import { name } from './text';
import { ScoreTable } from './YearEnd';

const tierName = (id: string | null) => (id ? content.rules.tiers.find((t) => t.id === id)?.name ?? id : 'A quiet year');
const levelTitle = (n: number) => content.progression.levels.find((l) => l.level === n)?.title ?? `Level ${n}`;
const orderName = (id: string) => orderById(id)?.label ?? id;
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
  const today = todayKey();
  const stats = dailyStats(years, today);
  const pick = (seed: string) => {
    setOpen(seed);
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => document.getElementById(`fest-${seed}`)?.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' }));
  };
  return (
    <div class="screen history paper">
      <header class="screen-head">
        <button class="btn small ghost" onClick={onBack}>
          ← Back
        </button>
        <h1>Past festivals</h1>
      </header>
      <DailyCalendar stats={stats} today={today} onPick={pick} />
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
              <li id={`fest-${y.seed}`} class={`${on ? 'open' : ''} ${y === best ? 'best' : ''}`}>
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

const monthOf = (y: number, m: number) => new Date(Date.UTC(y, m - 1, 1));
const monthName = (d: Date, year = false) => d.toLocaleDateString(undefined, { month: 'long', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' });

/** A month of daily years, each square in its festival's medal colour, with the streaks and the month's average under it. */
function DailyCalendar({ stats, today, onPick }: { stats: DailyStats; today: string; onPick: (seed: string) => void }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [y, m] = month.split('-').map(Number);
  const first = monthOf(y, m);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const step = (n: number) => setMonth(monthOf(y, m + n).toISOString().slice(0, 7));
  const sum = dailyMonth(stats, month);
  return (
    <section class="daily-cal" aria-label="Daily calendar">
      <div class="cal-head">
        <button class="btn small ghost" aria-label="Previous month" disabled={month <= (stats.first ?? today).slice(0, 7)} onClick={() => step(-1)}>
          ‹
        </button>
        <h2>{monthName(first, true)}</h2>
        <button class="btn small ghost" aria-label="Next month" disabled={month >= today.slice(0, 7)} onClick={() => step(1)}>
          ›
        </button>
      </div>
      <div class="cal-grid">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => (
          <span class="cal-wd" aria-hidden="true">
            {d}
          </span>
        ))}
        {Array.from({ length: first.getUTCDay() }, () => (
          <span />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = `${month}-${String(i + 1).padStart(2, '0')}`;
          const rec = stats.byDay[day];
          const label = `${monthName(first)} ${i + 1}`;
          if (rec)
            return (
              <button class={`cal-day played ${rec.tier ?? 'quiet'}`} aria-label={`${label}: ${tierName(rec.tier)}, ${rec.score} points`} onClick={() => onPick(rec.seed)}>
                <small>{i + 1}</small>
                <b>{rec.score}</b>
              </button>
            );
          const state = day === today ? 'today' : day > today ? 'later' : 'missed';
          return (
            <span class={`cal-day ${state}`}>
              <small>{i + 1}</small>
              {state !== 'later' && <span class="sr-only">{state === 'today' ? ', today, not played yet' : ', not played'}</span>}
            </span>
          );
        })}
      </div>
      {stats.first ? (
        <>
          <p class="small cal-sum">
            <b>
              Streak {stats.streak} day{stats.streak === 1 ? '' : 's'}
            </b>{' '}
            · longest {stats.longest}
          </p>
          <p class="small muted cal-sum">
            {monthName(first)}: {sum.played ? `${sum.played} played · average ${sum.average} · best ${sum.best}` : 'no daily years'}
          </p>
        </>
      ) : (
        <p class="small muted cal-sum">Play today's daily year to start a streak.</p>
      )}
    </section>
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
