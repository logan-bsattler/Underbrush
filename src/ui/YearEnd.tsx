import { useState } from 'preact/hooks';
import { challengeBonus, content, score, tiersFor, type ScoreBreakdown } from '../core';
import { Icon, Mushroom } from './art';
import { RenownPanel } from './Progress';
import type { Store } from './store';
import { shareResult, shareText } from './share';
import { name } from './text';

const artifactName = (id: string) => content.artifacts.find((a) => a.id === id)?.name ?? id;

/** The festival's points, row by row. Planted and coin counts are left out when they weren't kept, as in older history. */
export function ScoreTable({
  sc,
  total,
  orders,
  hybrids,
  planted,
  coins,
  artifacts,
}: {
  sc: ScoreBreakdown;
  total: number;
  orders: number;
  hybrids: string[];
  planted?: number;
  coins?: number;
  artifacts: string[];
}) {
  return (
    <table class="score-table">
      <tbody>
        <tr>
          <td>Orders delivered ({orders})</td>
          <td>{sc.orders}</td>
        </tr>
        <tr>
          <td>Hybrids made ({hybrids.map(name).join(', ') || 'none'})</td>
          <td>{sc.hybrids}</td>
        </tr>
        <tr>
          <td>Species planted{planted !== undefined && ` (${planted})`}</td>
          <td>{sc.planted}</td>
        </tr>
        <tr>
          <td>
            Coins left over ({coins !== undefined && `${coins}, `}1 point per {content.rules.coinsPerPoint}, up to {content.rules.maxCoinPoints})
          </td>
          <td>{sc.coins}</td>
        </tr>
        {sc.feast > 0 && (
          <tr>
            <td>Dishes the judges remember</td>
            <td>{sc.feast}</td>
          </tr>
        )}
        {sc.artifacts > 0 && (
          <tr>
            <td>Artifacts brought up ({artifacts.map(artifactName).join(', ')})</td>
            <td>{sc.artifacts}</td>
          </tr>
        )}
        {sc.cache > 0 && (
          <tr>
            <td>{content.cache.name}, found at last</td>
            <td>{sc.cache}</td>
          </tr>
        )}
        {sc.family > 0 && (
          <tr>
            <td>Family ribbons: the judges remember the family</td>
            <td>{sc.family}</td>
          </tr>
        )}
        <tr class="total">
          <td>Total</td>
          <td>{total}</td>
        </tr>
      </tbody>
    </table>
  );
}

export function YearEnd({ store, onTitle, onNewYear }: { store: Store; onTitle: () => void; onNewYear: () => void }) {
  const g = store.game!;
  const sc = score(g);
  const tiers = tiersFor(g);
  const next = tiers.find((t) => t.min > sc.total);
  const bonus = challengeBonus(g.perks.challenges);
  const tend = g.stats.tendActions.reduce((a, b) => a + b, 0);
  const idle = g.stats.idleActions.reduce((a, b) => a + b, 0);
  // Only mushrooms are drawn here: artifacts, layers and sets are told as lore during the year and scored below.
  const fresh = store.freshThisYear.filter((f) => !f.includes(':') || f.startsWith('hybrid:') || f.startsWith('lookalike:'));
  const won = store.freshThisYear.flatMap((f) => (f.startsWith('achievement:') ? content.achievements.filter((a) => `achievement:${a.id}` === f) : []));
  const record = store.journal.years.find((y) => y.seed === g.seed);
  const [shared, setShared] = useState<null | 'shared' | 'copied' | 'failed'>(null);
  const text = shareText(g, `${location.origin}${location.pathname}`);
  const share = async () => setShared(await shareResult(text));

  return (
    <div class="screen festival paper">
      <div class="eyebrow">
        The Harvest Festival · {g.mode === 'daily' ? `Daily year ${g.seed.replace(/^daily-/, '')}` : 'Story year'} ·{' '}
        {content.boards.find((b) => b.id === g.board)?.name}
      </div>
      <h1>{sc.tier ? sc.tier.name : 'A quiet year'}</h1>
      <div class={`medal ${sc.tier?.id ?? 'none'}`}>
        <Mushroom species="chanterelle" size={120} />
        <span class="medal-score">{sc.total}</span>
      </div>
      <p class="center">
        {next ? `${next.min - sc.total} more points would have earned ${next.name}.` : 'The village will talk about this festival for years.'}
      </p>

      <div class="share">
        <button class={`btn ${g.mode === 'daily' ? 'primary' : ''}`} onClick={share}>
          <Icon name="share" size={18} /> {g.mode === 'daily' ? "Share today's result" : 'Share this year'}
        </button>
        {shared === 'copied' && <span class="small muted">Copied. Paste it anywhere.</span>}
        {g.mode === 'daily' && !shared && <span class="small muted">Everyone played the same farm, weather and decks today.</span>}
      </div>
      {shared === 'failed' && <textarea class="share-text" readOnly rows={8} value={text} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />}

      {bonus > 0 && (
        <p class="center small">
          Challenges: {g.perks.challenges.map((id) => content.progression.challenges.find((x) => x.id === id)?.name).join(', ')}, +
          {Math.round(bonus * 100)}% renown.
        </p>
      )}
      {record && <RenownPanel record={record} journal={store.journal} />}

      <ScoreTable
        sc={sc}
        total={sc.total}
        orders={g.orders.filled.length}
        hybrids={g.hybridsMade}
        planted={g.planted.length}
        coins={g.coins}
        artifacts={g.artifacts}
      />

      <div class="tiers">
        {tiers.map((t) => (
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

      {won.length > 0 && (
        <>
          <h3>Achievements earned</h3>
          <ul class="achievements">
            {won.map((a) => (
              <li class="earned">
                <Icon name="spark" size={22} />
                <span>
                  <b>{a.name}</b>
                  <small>{a.rule}</small>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <details class="playtest">
        <summary>Playtest log</summary>
        <ul>
          <li>Actions spent tending: {tend} ({(tend / content.rules.rounds).toFixed(1)} a month)</li>
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
