import { content, gearUnlockLevel, orderPayment, saleValue, type GameState } from '../core';
import { Icon, Mushroom } from './art';
import { SheetFrame } from './Game';
import type { Store } from './store';
import { name } from './text';

export function Market({ g, store, onClose }: { g: GameState; store: Store; onClose: () => void }) {
  const close = () => {
    if (g.market) store.act({ type: 'leaveMarket' });
    onClose();
  };
  const stored = content.speciesOrder.filter((id) => (g.storage[id] ?? 0) > 0);
  const canTrade = !!g.market || (g.finale ? !g.finale.marketed : g.actionsLeft > 0);
  const lastWeek = g.round % content.rules.roundsPerSeason === 0 && g.round < content.rules.rounds;

  return (
    <SheetFrame title="Village market" onClose={close} tall>
      <p class={`market-visit ${g.market ? 'on' : ''}`}>
        {g.market
          ? `You're at the market. Trade as much as you like${g.market.orderFilled ? '' : ', and fill one order'}.`
          : g.finale
            ? g.finale.marketed
              ? "You've had your last market visit. The festival is next."
              : 'Festival morning: one last market visit, no action needed. Deliver one order and sell what you like.'
            : g.actionsLeft > 0
            ? 'A market visit takes 1 action, spent on your first trade. Fill one order per visit.'
            : 'No actions left to visit the market this week.'}
      </p>

      <h3>Festival orders</h3>
      <div class="order-cards">
        {g.orders.visible.map((id) => {
          const o = content.orders.find((x) => x.id === id)!;
          const pay = orderPayment(g.storage, o);
          const blocked = !pay || !canTrade || g.market?.orderFilled;
          return (
            <div class={`order-card ${pay ? 'ready' : ''}`}>
              <div class="order-card-top">
                <span>{o.label}</span>
                <span class="pts">{o.points} pts</span>
              </div>
              {pay && <div class="small muted">Uses {Object.entries(pay).map(([id, n]) => `${n} ${name(id)}`).join(', ')}</div>}
              <button class="btn small primary" disabled={!!blocked} onClick={() => store.act({ type: 'fillOrder', order: id })}>
                Deliver
              </button>
            </div>
          );
        })}
      </div>
      <p class="small muted">
        {g.orders.filled.length} delivered · {g.orderPoints} points · {g.orders.deck.length} more orders waiting
      </p>

      <h3>Your storage</h3>
      {lastWeek && !g.gear.includes('dehydrator') && stored.length > 0 && (
        <p class="note warn">Last week of the season: anything still in storage spoils tonight.</p>
      )}
      {stored.length === 0 ? (
        <p class="muted">Nothing stored. Harvest fruiting beds, or identify wild finds.</p>
      ) : (
        <ul class="storage">
          {stored.map((id) => {
            const each = saleValue(g, id);
            return (
              <li>
                <Mushroom species={id} size={40} />
                <span class="grow">
                  <b>{name(id)}</b> × {g.storage[id]}
                  <small class="muted"> · {each} each</small>
                </span>
                <button class="btn small" disabled={!canTrade} onClick={() => store.act({ type: 'sell', species: id, count: 1 })}>
                  Sell 1
                </button>
                {g.storage[id] > 1 && (
                  <button class="btn small" disabled={!canTrade} onClick={() => store.act({ type: 'sell', species: id, count: g.storage[id] })}>
                    All
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!g.finale && (
        <>
        <h3>
          Gear <span class="chip coins inline"><Icon name="coin" size={16} /> {g.coins}</span>
        </h3>
        <div class="gear">
          {content.gear.map((gear) => {
            const owned = g.gear.includes(gear.id);
            const stocked = g.perks.shop.includes(gear.id);
            if (!stocked) {
              const at = gearUnlockLevel(gear.id);
              return (
                <div class="gear-card locked">
                  <div class="gear-top">
                    <b>{gear.name}</b>
                  </div>
                  <div class="small muted">{at ? `Stocked once your homestead reaches ${at.title} (level ${at.level}).` : 'Not stocked.'}</div>
                </div>
              );
            }
            return (
              <div class={`gear-card ${owned ? 'owned' : ''}`}>
                <div class="gear-top">
                  <b>{gear.name}</b>
                  <span class="cost">
                    {owned ? (g.perks.heirlooms.includes(gear.id) ? 'Heirloom' : 'Owned') : (
                      <>
                        <Icon name="coin" size={14} /> {gear.cost}
                      </>
                    )}
                  </span>
                </div>
                <div class="small">{gear.rule}</div>
                {!owned && (
                  <button class="btn small" disabled={g.coins < gear.cost || !canTrade} onClick={() => store.act({ type: 'buyGear', gear: gear.id })}>
                    Buy
                  </button>
                )}
              </div>
            );
          })}
        </div>
        </>
      )}
      <button class="btn wide" onClick={close}>
        {g.market ? 'Head home' : 'Close'}
      </button>
    </SheetFrame>
  );
}
