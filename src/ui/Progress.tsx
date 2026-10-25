import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  boardsFor,
  boardUnlockLevel,
  content,
  heirloomChoices,
  heirloomSlots,
  levelFor,
  masteryLevel,
  newGame,
  nextLevel,
  perksFor,
  standardPerks,
  type Journal,
  type LevelDef,
  type Unlock,
  type YearRecord,
} from '../core';
import { Icon, Mushroom, Unknown } from './art';
import { Farm } from './Game';
import type { Store } from './store';
import { masteryName, name } from './text';

const gearName = (id: string) => content.gear.find((g) => g.id === id)?.name ?? id;

export function unlockText(u: Unlock): string {
  switch (u.type) {
    case 'gear': {
      const zone = content.zones.find((z) => z.unlock === u.id);
      return zone ? `${gearName(u.id)} in the shop, which opens the ${zone.name}` : `${gearName(u.id)} in the shop`;
    }
    case 'heirloomSlot':
      return 'One more heirloom to carry into each year';
    case 'farmSize':
      return `Your farm grows to ${u.size}×${u.size}`;
    case 'startCoins':
      return `Start each year with ${u.amount} more coins`;
    case 'actions':
      return `${content.rules.actionsPerRound + u.amount} actions a month`;
    case 'board':
      return `The ${content.boards.find((b) => b.id === u.id)?.name ?? u.id} farm to start a year on`;
    case 'autoHarvest':
      return 'Fruiting beds are picked into storage every morning';
  }
}

/** The homestead's level and progress toward the next one, from the journal. */
export function standing(j: Journal) {
  const level = levelFor(j.renown);
  const next = nextLevel(j.renown);
  const into = j.renown - level.renown;
  const span = next ? next.renown - level.renown : 1;
  return { level, next, into, span, pct: next ? Math.min(1, into / span) : 1 };
}

function Bar({ pct, from }: { pct: number; from?: number }) {
  const [w, setW] = useState(from ?? pct);
  useEffect(() => {
    const t = setTimeout(() => setW(pct), 250);
    return () => clearTimeout(t);
  }, [pct]);
  return (
    <div class="renown-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)}>
      <span style={{ width: `${Math.round(w * 100)}%` }} />
    </div>
  );
}

export function HomesteadCard({ journal, onAlmanac }: { journal: Journal; onAlmanac: () => void }) {
  const st = standing(journal);
  const years = journal.years.filter((y) => y.mode === 'story').length;
  return (
    <button class="homestead" onClick={onAlmanac} aria-label={`Homestead level ${st.level.level}, ${st.level.title}. Open the almanac`}>
      <span class="hs-level">{st.level.level}</span>
      <span class="hs-body">
        <span class="hs-title">{st.level.title}</span>
        <span class="small muted">
          {journal.renown} renown{years ? ` · ${years} year${years === 1 ? '' : 's'} on the homestead` : ''}
        </span>
        <Bar pct={st.pct} />
        <span class="small">
          {st.next ? `${st.next.renown - journal.renown} to ${st.next.title}: ${unlockText(st.next.unlocks[0])}` : 'Every unlock earned'}
        </span>
      </span>
    </button>
  );
}

function LevelRow({ l, j }: { l: LevelDef; j: Journal }) {
  const reached = j.renown >= l.renown;
  const isNext = nextLevel(j.renown)?.level === l.level;
  return (
    <li class={`level ${reached ? 'reached' : ''} ${isNext ? 'next' : ''}`}>
      <span class="lv-num">{l.level}</span>
      <div class="lv-body">
        <div class="lv-head">
          <b>{l.title}</b>
          <span class="small muted">{l.renown} renown</span>
        </div>
        <p class="small muted">{l.blurb}</p>
        <ul class="unlocks">
          {l.unlocks.map((u) => (
            <li>{unlockText(u)}</li>
          ))}
        </ul>
      </div>
    </li>
  );
}

export function Almanac({ store, onBack }: { store: Store; onBack: () => void }) {
  const j = store.journal;
  const st = standing(j);
  const species = content.speciesOrder.filter((id) => content.species[id].kind !== 'hybrid');
  const top = content.progression.mastery[content.progression.mastery.length - 1];
  return (
    <div class="screen almanac paper">
      <header class="screen-head">
        <button class="btn small ghost" onClick={onBack}>
          ← Back
        </button>
        <h1>Almanac</h1>
      </header>
      <HomesteadCard journal={j} onAlmanac={() => {}} />
      <p class="small muted">
        Your festival score each story or daily year becomes renown. Renown raises your homestead's level, and every level brings
        something new into the years that follow.
      </p>

      <h2>The homestead</h2>
      <ol class="levels">
        {content.progression.levels.map((l) => (
          <LevelRow l={l} j={j} />
        ))}
      </ol>
      <p class="note">
        Heirlooms: at the start of a story year, choose gear you've bought before to own from the first month. You have {heirloomSlots(st.level.level)}{' '}
        slot{heirloomSlots(st.level.level) === 1 ? '' : 's'}.
      </p>

      <h2>Species mastery</h2>
      <p class="small muted">Every real identification counts, across all your years.</p>
      <ul class="mastery-steps">
        {content.progression.mastery.map((m) => (
          <li>
            <b>{m.name}</b> at {m.ids}: {m.rule}
          </li>
        ))}
      </ul>
      <ul class="mastery">
        {species.map((id) => {
          const n = j.idCounts[id] ?? 0;
          const lvl = masteryLevel(n);
          const nextM = content.progression.mastery.find((m) => m.ids > n);
          const known = j.discovered.includes(id);
          return (
            <li>
              {known ? <Mushroom species={id} size={40} /> : <Unknown species={id} size={40} />}
              <div class="grow">
                <div class="mastery-head">
                  <b>{known ? name(id) : content.species[id].group}</b>
                  <span class={`mastery-tag m${lvl}`}>{lvl ? masteryName(lvl) : 'New'}</span>
                </div>
                <Bar pct={nextM ? n / nextM.ids : 1} />
                <small class="muted">{nextM ? `${n} of ${nextM.ids} identified for ${nextM.name}` : `${n} identified · ${top.name}`}</small>
              </div>
            </li>
          );
        })}
      </ul>
      <p class="disclaimer">In-game knowledge only. Underbrush is not a foraging guide.</p>
    </div>
  );
}

export function Pack({ store, onStart, onBack }: { store: Store; onStart: (heirlooms: string[], board: string) => void; onBack: () => void }) {
  const j = store.journal;
  const st = standing(j);
  const slots = heirloomSlots(st.level.level);
  const choices = heirloomChoices(j);
  const boards = boardsFor(j);
  const [picked, setPicked] = useState<string[]>(() => choices.slice(0, slots));
  const [board, setBoard] = useState(() => {
    // Start on the board of the last story year, if it's still open to you.
    const last = store.game?.mode === 'story' ? store.game.board : null;
    return last && boards.includes(last) ? last : boards[0];
  });
  const perks = perksFor(j, picked);
  const year = j.years.filter((y) => y.mode === 'story').length + 1;
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < slots ? [...p, id] : [...p.slice(1), id]));

  return (
    <div class="screen pack paper">
      <header class="screen-head">
        <button class="btn small ghost" onClick={onBack}>
          ← Back
        </button>
        <h1>Year {year}</h1>
      </header>

      <h2>Choose your land</h2>
      <div class="boards" role="radiogroup" aria-label="Farm">
        {content.boards.map((b) => {
          const open = boards.includes(b.id);
          const at = open ? null : boardUnlockLevel(b.id);
          return (
            // A div, not a button: the preview inside is a farm grid made of buttons.
            <div
              class={`board-card ${board === b.id ? 'on' : ''} ${open ? '' : 'locked'}`}
              role="radio"
              tabIndex={open ? 0 : -1}
              aria-checked={board === b.id}
              aria-disabled={!open}
              onClick={() => open && setBoard(b.id)}
              onKeyDown={(e) => open && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setBoard(b.id))}
            >
              <BoardPreview id={b.id} size={perks.size} />
              <b>{b.name}</b>
              <small>{open ? b.blurb : at ? `Opens at ${at.title} (level ${at.level}).` : 'Not open yet.'}</small>
            </div>
          );
        })}
      </div>

      {slots > 0 && choices.length > 0 && (
        <>
          <h2>Pack heirlooms</h2>
          <p>
            As a {st.level.title}, you can carry {slots} heirloom{slots === 1 ? '' : 's'} from earlier years; you'll own{' '}
            {slots === 1 ? 'it' : 'them'} from the first month.
          </p>
          <div class="heirlooms" role="group" aria-label="Heirlooms">
            {choices.map((id) => {
              const g = content.gear.find((x) => x.id === id)!;
              const on = picked.includes(id);
              return (
                <button class={`heirloom ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggle(id)}>
                  <span class="hl-check" aria-hidden="true">
                    {on ? '✓' : ''}
                  </span>
                  <b>{g.name}</b>
                  <small>{g.rule}</small>
                </button>
              );
            })}
          </div>
          <p class="small muted">
            {picked.length} of {slots} packed
          </p>
        </>
      )}
      <h2>This year</h2>
      <ul class="this-year">
        <li>
          {perks.size}×{perks.size} farm on {content.boards.find((b) => b.id === board)?.name}
        </li>
        <li>{content.rules.actionsPerRound + perks.bonusActions} actions a month</li>
        <li>{content.rules.startCoins + perks.bonusCoins} coins to start</li>
        <li>Shop stocks {perks.shop.map(gearName).join(', ')}</li>
        {perks.spawn.length > 0 && <li>Spawn of {perks.spawn.map(name).join(', ')} at the market</li>}
        {perks.autoHarvest && <li>Ripe beds are picked every morning</li>}
      </ul>
      <button class="btn primary big wide" onClick={() => onStart(picked, board)}>
        Start year {year}
      </button>
    </div>
  );
}

/** A small picture of a board's starting farm. */
export function BoardPreview({ id, size = 4 }: { id: string; size?: number }) {
  const g = useMemo(() => newGame({ seed: `preview-${id}`, board: id, perks: { ...standardPerks(), size } }), [id, size]);
  return (
    <span class="board-preview" aria-hidden="true">
      <Farm g={g} small />
    </span>
  );
}

/** Renown earned, level-ups and mastery gains for the year just finished. */
export function RenownPanel({ record, journal }: { record: YearRecord; journal: Journal }) {
  const levels = content.progression.levels;
  const gained = levels.filter((l) => l.level > record.levelFrom && l.level <= record.levelTo);
  const before = journal.renown - record.renown;
  const st = standing(journal);
  const fromPct = (() => {
    const l = levelFor(before);
    const n = nextLevel(before);
    return gained.length ? 0 : n ? (before - l.renown) / (n.renown - l.renown) : 1;
  })();
  return (
    <section class="renown-panel">
      <div class="rp-head">
        <span class="rp-gain">+{record.renown}</span>
        <span>
          renown · {st.level.title}, level {st.level.level}
        </span>
      </div>
      <Bar pct={st.pct} from={fromPct} />
      <p class="small muted">{st.next ? `${st.next.renown - journal.renown} more renown to ${st.next.title}.` : 'Your homestead has earned every unlock.'}</p>
      {gained.map((l) => (
        <div class="level-up">
          <Icon name="spark" size={22} />
          <div>
            <b>Your homestead is now {l.title}.</b>
            <ul>
              {l.unlocks.map((u) => (
                <li>{unlockText(u)}</li>
              ))}
            </ul>
          </div>
        </div>
      ))}
      {record.masteryUps.length > 0 && (
        <div class="mastery-ups">
          {record.masteryUps.map((id) => {
            const lvl = masteryLevel(journal.idCounts[id] ?? 0);
            const m = content.progression.mastery.find((x) => x.level === lvl);
            return (
              <div class="mastery-up">
                <Mushroom species={id} size={40} />
                <span>
                  <b>
                    {name(id)}: {m?.name}.
                  </b>{' '}
                  {m?.rule}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
