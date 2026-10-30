import {
  basketCapacity,
  commissionCost,
  compostSaleValue,
  content,
  deliveryCost,
  gearUnlockLevel,
  hireCost,
  nextCommission,
  orderById,
  orderPayment,
  orderSpecies,
  saleValue,
  spawnCost,
  spawnStock,
  swapCost,
  type GameState,
  type Substrate,
} from '../core';
import { Icon, Mushroom, SubstrateArt } from './art';
import { SheetFrame } from './Game';
import type { Store } from './store';
import { name, substrateName } from './text';

/** The commission slot: one bigger order at a time, paid for up front and lost if it isn't delivered by the festival. */
function Commission({ g, store, canTrade, extra }: { g: GameState; store: Store; canTrade: boolean; extra: number }) {
  const cost = commissionCost(g);
  const open = g.commission.open ? orderById(g.commission.open)! : null;
  const pay = open ? orderPayment(g.storage, open) : null;
  // What taking one would deal, so the ask and the reward are known before paying.
  const nextId = open ? null : nextCommission(g);
  const next = nextId ? orderById(nextId)! : null;
  return (
    <>
      <h3>Commission</h3>
      {open ? (
        <div class={`order-card commission ${pay ? 'ready' : ''}`}>
          <div class="order-card-top">
            <span>{open.label}</span>
            <span class="pts">{open.points} pts</span>
          </div>
          {pay && <div class="small muted">Uses {Object.entries(pay).map(([id, n]) => `${n} ${name(id)}`).join(', ')}</div>}
          {!pay && (open.need.kind === 'zone' || open.need.kind === 'below') && <div class="small muted">Any of: {orderSpecies(open)!.map(name).join(', ')}</div>}
          <div class="order-card-actions">
            <button class="btn small primary" disabled={!pay || !canTrade || g.coins < extra} onClick={() => store.act({ type: 'fillOrder', order: open.id })}>
              Deliver
              {extra > 0 && (
                <>
                  {' · '}
                  <Icon name="coin" size={13} /> {extra}
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <ul class="storage">
          <li>
            <Icon name="coin" size={40} />
            <span class="grow">
              <b>Take a commission</b>
              {next ? (
                <small class="muted">
                  {' '}
                  · {next.label}, {next.points} pts
                </small>
              ) : (
                <small class="muted"> · nothing more the valley needs this year</small>
              )}
            </span>
            <button
              class="btn small"
              disabled={!!g.finale || !canTrade || g.coins < cost || !next}
              onClick={() => store.act({ type: 'takeCommission' })}
              aria-label={`Take a commission, ${cost} coins`}
            >
              <Icon name="coin" size={14} /> {cost}
            </button>
          </li>
        </ul>
      )}
      <p class="small muted">
        Paid up front, one at a time, and the coins are gone if it isn't delivered by the festival. Each one this year costs double the
        last. {g.commission.taken ? `${g.commission.taken} taken this year.` : ''}
      </p>
    </>
  );
}

export function Market({ g, store, onClose, onPantry }: { g: GameState; store: Store; onClose: () => void; onPantry: () => void }) {
  // Closing the sheet keeps the visit open: it ends when you next spend an action, so coming back to trade is free.
  const close = onClose;
  const stored = content.speciesOrder.filter((id) => (g.storage[id] ?? 0) > 0);
  const compost = g.shed.filter((x) => x === 'compost').length;
  const canTrade = !!g.market || (g.finale ? !g.finale.marketed : g.actionsLeft > 0);
  const lastMonth = g.round % content.rules.roundsPerSeason === 0 && g.round < content.rules.rounds;
  const swap = swapCost(g);
  const spawn = spawnStock(g);
  const roomInBasket = g.basket.length < basketCapacity(g);
  const extra = deliveryCost(g);
  const hire = hireCost(g);
  const hired = g.hiredRound === g.round;
  const stall = Object.entries(content.rules.substrateCost) as [Substrate, number][];

  return (
    <SheetFrame title="Village market" onClose={close} tall>
      <p class={`market-visit ${g.market ? 'on' : g.finale ? '' : g.actionsLeft > 0 ? 'off' : 'closed'}`}>
        {g.market
          ? `You're at the market. Trade as much as you like${g.market.deliveries ? `; another delivery costs ${extra} coins` : ''}. Your visit lasts until you spend another action.`
          : g.finale
            ? g.finale.marketed
              ? "You've had your last market visit. The festival is next."
              : `Festival morning: one last market visit, no action needed. Deliver an order free, more for ${content.rules.extraDeliveryCost} coins and doubling after that, and sell what you like.`
            : g.actionsLeft > 0
            ? `You're not at the market right now. Your next trade opens a visit for 1 action (${g.actionsLeft} left), and the visit ends when you spend an action on anything else. The first order you deliver on a visit is free; the next costs ${content.rules.extraDeliveryCost} coins, and each one after costs double the last.`
            : `You're not at the market, and opening a visit takes an action: you have none left this month. Hiring a hand needs no visit${hired ? ", but you've hired one this month" : ''}.`}
      </p>

      <h3>Festival orders</h3>
      <div class="order-cards">
        {g.orders.visible.map((id) => {
          const o = content.orders.find((x) => x.id === id)!;
          const pay = orderPayment(g.storage, o);
          const blocked = !pay || !canTrade || g.coins < extra;
          return (
            <div class={`order-card ${pay ? 'ready' : ''}`}>
              <div class="order-card-top">
                <span>{o.label}</span>
                <span class="pts">{o.points} pts</span>
              </div>
              {pay && <div class="small muted">Uses {Object.entries(pay).map(([id, n]) => `${n} ${name(id)}`).join(', ')}</div>}
              {!pay && (o.need.kind === 'zone' || o.need.kind === 'below') && (
                <div class="small muted">Any of: {orderSpecies(o)!.map(name).join(', ')}</div>
              )}
              <div class="order-card-actions">
                <button
                  class="btn small primary"
                  disabled={!!blocked}
                  onClick={() => store.act({ type: 'fillOrder', order: id })}
                  aria-label={extra ? `Deliver this order, ${extra} coins` : 'Deliver this order'}
                >
                  Deliver
                  {extra > 0 && (
                    <>
                      {' · '}
                      <Icon name="coin" size={13} /> {extra}
                    </>
                  )}
                </button>
                <button
                  class="btn small ghost"
                  disabled={!canTrade || g.coins < swap || g.orders.deck.length === 0}
                  onClick={() => store.act({ type: 'swapOrder', order: id })}
                  aria-label={`Swap this order for the next one, ${swap} coins`}
                >
                  Swap · <Icon name="coin" size={13} /> {swap}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p class="small muted">
        {g.orders.filled.length} delivered · {g.orderPoints} points · {g.orders.deck.length} more orders waiting. Swapping sends an order to
        the bottom of the pile and deals the first waiting order your storage can fill, if there is one; each swap this year costs a
        coin more.
      </p>

      {g.perks.commissions && <Commission g={g} store={store} canTrade={canTrade} extra={extra} />}

      <h3>
        Your storage
        <button class="btn small ghost inline-link" onClick={onPantry}>
          <Icon name="pantry" size={16} /> Cook or save spawn
        </button>
      </h3>
      {lastMonth && !g.gear.includes('dehydrator') && stored.length > 0 && (
        <p class="note warn">Last month of the season: anything still in storage spoils tonight.</p>
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

      {compost > 0 && (
        <>
          <h3>Your shed</h3>
          <ul class="storage">
            <li>
              <SubstrateArt substrate="compost" size={40} />
              <span class="grow">
                <b>Compost tile</b> × {compost}
                <small class="muted"> · {compostSaleValue(g)} each</small>
              </span>
              <button class="btn small" disabled={!canTrade} onClick={() => store.act({ type: 'sellCompost', count: 1 })}>
                Sell 1
              </button>
              {compost > 1 && (
                <button class="btn small" disabled={!canTrade} onClick={() => store.act({ type: 'sellCompost', count: compost })}>
                  All
                </button>
              )}
            </li>
          </ul>
        </>
      )}

      {!g.finale && (
        <>
          <h3>Spawn</h3>
          {spawn.length === 0 ? (
            <p class="small muted">Identify a cultivated mushroom and the seed merchant will stock its spawn here.</p>
          ) : (
            <>
              <ul class="storage">
                {spawn.map((id) => {
                  const cost = spawnCost(id);
                  return (
                    <li>
                      <Mushroom species={id} size={40} />
                      <span class="grow">
                        <b>{name(id)} spawn</b>
                        <small class="muted"> · ready to plant</small>
                      </span>
                      <button
                        class="btn small"
                        disabled={!canTrade || g.coins < cost || !roomInBasket}
                        onClick={() => store.act({ type: 'buySpawn', species: id })}
                      >
                        <Icon name="coin" size={14} /> {cost}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p class="small muted">{roomInBasket ? 'Spawn goes into your basket, already identified.' : 'Your basket is full.'}</p>
            </>
          )}
        </>
      )}

      {!g.finale && (
        <>
          <h3>Hands and supplies</h3>
          <ul class="storage">
            <li>
              <Icon name="tend" size={40} />
              <span class="grow">
                <b>Hire a hand</b>
                <small class="muted"> · +1 action this month</small>
              </span>
              <button class="btn small" disabled={hired || g.coins < hire} onClick={() => store.act({ type: 'hireHand' })}>
                <Icon name="coin" size={14} /> {hire}
              </button>
            </li>
            {stall.map(([sub, cost]) => (
              <li>
                <SubstrateArt substrate={sub} size={40} />
                <span class="grow">
                  <b>{substrateName[sub]} tile</b>
                  <small class="muted"> · to your shed</small>
                </span>
                <button class="btn small" disabled={!canTrade || g.coins < cost} onClick={() => store.act({ type: 'buySubstrate', substrate: sub })}>
                  <Icon name="coin" size={14} /> {cost}
                </button>
              </li>
            ))}
          </ul>
          <p class="small muted">
            {hired
              ? "You've hired a hand this month."
              : `A hand needs no market visit: one a month, and each one this year costs ${content.rules.hireStep} coins more.`}{' '}
            Tiles go to your shed; lay them on empty ground for free.
          </p>
        </>
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
        Close
      </button>
    </SheetFrame>
  );
}
