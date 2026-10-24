import { content, score } from '../core';
import { Mushroom } from './art';
import { RenownPanel } from './Progress';
import type { Store } from './store';
import { name } from './text';

export function YearEnd({ store, onTitle, onNewYear }: { store: Store; onTitle: () => void; onNewYear: () => void }) {
  const g = store.game!;
  const sc = score(g);
  const next = content.rules.tiers.find((t) => t.min > sc.total);
  const tend = g.stats.tendActions.reduce((a, b) => a + b, 0);
  const idle = g.stats.idleActions.reduce((a, b) => a + b, 0);
  const fresh = store.freshThisYear;
  const record = store.journal.years.find((y) => y.seed === g.seed);

  return (
    <div class="screen festival paper">
      <div class="eyebrow">The Harvest Festival · {g.mode === 'daily' ? 'Daily year' : 'Story year'}</div>
      <h1>{sc.tier ? sc.tier.name : 'A quiet year'}</h1>
      <div class={`medal ${sc.tier?.id ?? 'none'}`}>
        <Mushroom species="chanterelle" size={120} />
        <span class="medal-score">{sc.total}</span>
      </div>
      <p class="center">
        {next ? `${next.min - sc.total} more points would have earned ${next.name}.` : 'The village will talk about this festival for years.'}
      </p>

      {record && <RenownPanel record={record} journal={store.journal} />}

      <table class="score-table">
        <tbody>
          <tr>
            <td>Orders delivered ({g.orders.filled.length})</td>
            <td>{sc.orders}</td>
          </tr>
          <tr>
            <td>Hybrids made ({g.hybridsMade.map(name).join(', ') || 'none'})</td>
            <td>{sc.hybrids}</td>
          </tr>
          <tr>
            <td>Species planted ({g.planted.length})</td>
            <td>{sc.planted}</td>
          </tr>
          <tr class="total">
            <td>Total</td>
            <td>{sc.total}</td>
          </tr>
        </tbody>
      </table>

      <div class="tiers">
        {content.rules.tiers.map((t) => (
          <span class={`tier ${sc.tier?.id === t.id ? 'on' : ''}`}>
            <b>{t.name}</b>
            <small>{t.min}+</small>
          </span>
        ))}
      </div>

      {fresh.length > 0 && (
        <>
          <h3>New in your field journal</h3>
          <div class="fresh">
            {fresh.map((f) => {
              const [kind, id] = f.includes(':') ? f.split(':') : ['species', f];
              return (
                <span class="fresh-item">
                  <Mushroom species={id} size={44} />
                  <small>
                    {kind === 'lookalike' ? `${content.species[id].lookalike?.name}` : name(id)}
                    {kind === 'hybrid' ? ' (made)' : kind === 'lookalike' ? ' (lookalike)' : ''}
                  </small>
                </span>
              );
            })}
          </div>
        </>
      )}

      <details class="playtest">
        <summary>Playtest log</summary>
        <ul>
          <li>Actions spent tending: {tend} ({(tend / content.rules.rounds).toFixed(1)} a week)</li>
          <li>Actions left unused: {idle}</li>
          <li>
            Forage trips: {g.stats.trips}, busts: {g.stats.busts}
          </li>
          <li>Lookalikes picked: {g.stats.lookalikes}</li>
          <li>
            Compost: {g.stats.scraps} scraps on the pile, {g.stats.compostTiles} Compost tile{g.stats.compostTiles === 1 ? '' : 's'} made
          </li>
          <li>Coins earned: {g.stats.coinsEarned}</li>
          <li>Seed: {g.seed}</li>
        </ul>
      </details>

      <div class="col">
        <button class="btn primary big" onClick={onNewYear}>
          Start a new year
        </button>
        <button class="btn" onClick={onTitle}>
          Back to title
        </button>
      </div>
    </div>
  );
}
