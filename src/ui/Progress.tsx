import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  achievementProgress,
  artifactHome,
  boardsFor,
  boardUnlockLevel,
  challengeBonus,
  completedSets,
  content,
  generationLore,
  tierLift,
  heirloomChoices,
  heirloomSlots,
  isLegend,
  layersOpen,
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
const zoneName = (id: string) => content.zones.find((z) => z.id === id)?.name ?? id;
const ordinal = (n: number) => ['first', 'second', 'third', 'fourth', 'fifth'][n - 1] ?? `${n}th`;

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
    case 'commissions':
      return 'Take paid commissions at the market: bigger orders for more points';
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
        <span class="hs-title">
          {st.level.title}
          {journal.generation > 1 && <span class="hs-gen"> · generation {journal.generation}</span>}
        </span>
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

export function Almanac({ store, onBack, onHistory }: { store: Store; onBack: () => void; onHistory: () => void }) {
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
      {j.years.length > 0 && (
        <button class="btn wide" onClick={onHistory}>
          Past festivals ({j.years.length})
        </button>
      )}

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

      {(isLegend(j) || j.generation > 1) && <Legacy store={store} />}

      <Cabinet j={j} />

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
      <h2>Achievements</h2>
      <ul class="achievements">
        {content.achievements.map((a) => {
          const got = j.achievements.includes(a.id);
          const year = !got && store.game && !store.game.over ? achievementProgress(a.check, store.game) : null;
          return (
            <li class={got ? 'earned' : ''}>
              <Icon name="spark" size={22} />
              <span>
                <b>{a.name}</b>
                <small>{a.rule}</small>
                {year && (
                  <small class="muted">
                    This year: {Math.min(year.have, year.need)} of {year.need}
                  </small>
                )}
                {a.check.type === 'clearZone' && j.zonesCleared.length > 0 && (
                  <small class="muted">Cleared: {content.zones.filter((z) => j.zonesCleared.includes(z.id)).map((z) => z.name).join(', ')}</small>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p class="disclaimer">In-game knowledge only. Underbrush is not a foraging guide.</p>
    </div>
  );
}

/** The cabinet of curiosities: every artifact set, what the family has found of it, and the lore that hints at the rest. */
function Cabinet({ j }: { j: Journal }) {
  const done = completedSets(j.artifacts);
  return (
    <>
      <h2>Cabinet of curiosities</h2>
      <p class="small muted">
        Under every zone lie older places. Each generation that takes on the homestead can climb down one layer further, and each layer
        hides one artifact. Bring a whole set home and the family keeps its perk for every story year after.
      </p>
      <ul class="cabinet">
        {content.artifactSets.map((set) => {
          const complete = done.includes(set.id);
          return (
            <li class={complete ? 'complete' : ''}>
              <div class="cab-head">
                <b>{set.name}</b>
                <span class="small muted">
                  {content.artifacts.filter((a) => a.set === set.id && j.artifacts.includes(a.id)).length} of{' '}
                  {content.artifacts.filter((a) => a.set === set.id).length}
                </span>
              </div>
              <ul class="relics">
                {content.artifacts
                  .filter((a) => a.set === set.id)
                  .map((a) => {
                    const found = j.artifacts.includes(a.id);
                    const home = artifactHome(a.id);
                    return (
                      <li class={found ? 'found' : ''}>
                        <Icon name="relic" size={20} />
                        <span>
                          <b>{found ? a.name : 'Not yet found'}</b>
                          <small>{found ? a.blurb : home ? `Somewhere in the ${ordinal(home.depth)} layer below the ${zoneName(home.zone)}.` : ''}</small>
                        </span>
                      </li>
                    );
                  })}
              </ul>
              {complete ? <p class="small cab-rule">{set.rule}</p> : <p class="small lore-line">{set.clue}</p>}
            </li>
          );
        })}
      </ul>
      {j.artifacts.length > 0 && <Riddle j={j} />}
    </>
  );
}

/** The founder's riddle: the mark on every artifact found so far, and once the cellar is found, its story to read again. */
function Riddle({ j }: { j: Journal }) {
  const { cache } = content;
  const marked = j.artifacts.flatMap((id) => content.artifacts.filter((a) => a.id === id && a.inscription));
  // The cellar won't open until the marks point to the tree, the place and the season.
  const enough = new Set(marked.flatMap((a) => (a.mark ? [a.mark] : []))).size === 3;
  return (
    <section class={`riddle ${j.cacheFound ? 'solved' : ''}`}>
      <h3>The founder's riddle</h3>
      <p class="small lore-line">{cache.premise}</p>
      <ul class="relics">
        {marked.map((a) => (
          <li class="found">
            <Icon name="relic" size={20} />
            <span>
              <b>{a.name}</b>
              <small>{a.inscription}</small>
            </span>
          </li>
        ))}
      </ul>
      {j.cacheFound ? (
        <div class="riddle-end">
          <b>{cache.name}, found</b>
          <p class="small">{cache.place}</p>
          <p class="small lore-line">{cache.ending}</p>
        </div>
      ) : (
        <p class="small muted">
          {marked.length} of {content.artifacts.length} marks found.{' '}
          {enough
            ? "They say enough now to know where to dig. With a Spade, tap a turned card of plain ground on a story year's trip to dig under it; a dig ends the trip."
            : "They don't say enough yet to know where the founder dug. Bring home more from below."}
        </p>
      )}
    </section>
  );
}

/** Passing the homestead on: what it costs, what carries down, and the generations so far. */
function Legacy({ store }: { store: Store }) {
  const j = store.journal;
  const { tierStep, startCoins } = content.progression.legacy;
  const lore = generationLore(j.generation);
  const [sure, setSure] = useState(false);
  useEffect(() => {
    if (!sure) return;
    const t = setTimeout(() => setSure(false), 4000);
    return () => clearTimeout(t);
  }, [sure]);
  return (
    <>
      <h2>Pass it on</h2>
      <p class="small">
        A Legend of the Valley can hand the homestead down. The next generation starts again at level 1 with no renown or gear, and every
        festival tier sits {tierStep} points higher. Your field journal, species mastery, achievements and cabinet of curiosities stay in
        the family, each generation starts every year with {startCoins} more coins, and each one can climb one layer further below every
        zone.
      </p>
      {lore && (
        <p class="small lore-line">
          {lore.layer.clue} <span class="muted">({ordinal(lore.depth)} layer below the {zoneName(lore.zone)})</span>
        </p>
      )}
      {j.lineage.length > 0 && (
        <ul class="lineage">
          {j.lineage.map((l) => (
            <li>
              Generation {l.generation}: {l.renown} renown over {l.years} story year{l.years === 1 ? '' : 's'}
            </li>
          ))}
          <li>
            <b>Generation {j.generation}</b>: working the homestead now
          </li>
        </ul>
      )}
      {isLegend(j) && (
        <button
          class={`btn ${sure ? 'primary' : ''} wide`}
          onClick={() => {
            if (!sure) return setSure(true);
            setSure(false);
            store.passItOn();
          }}
        >
          {sure ? `Tap again: start generation ${j.generation + 1} at level 1` : 'Pass the homestead on'}
        </button>
      )}
    </>
  );
}

export function Pack({
  store,
  onStart,
  onBack,
}: {
  store: Store;
  onStart: (heirlooms: string[], board: string, challenges: string[]) => void;
  onBack: () => void;
}) {
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
  const [taken, setTaken] = useState<string[]>([]);
  const legend = isLegend(j);
  const perks = perksFor(j, picked, undefined, taken);
  const lean = perks.challenges.includes('leanyear');
  const bonus = challengeBonus(perks.challenges);
  const year = j.years.filter((y) => y.mode === 'story').length + 1;
  const layers = Math.max(...content.zones.map((z) => layersOpen(perks.generation, z.id)));
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
      {legend && (
        <>
          <h2>Legend challenges</h2>
          <p>Take on a handicap this year for more renown. Stack as many as you dare.</p>
          <div class="heirlooms" role="group" aria-label="Challenges">
            {content.progression.challenges.map((ch) => {
              const on = taken.includes(ch.id);
              return (
                <button
                  class={`heirloom ${on ? 'on' : ''}`}
                  aria-pressed={on}
                  onClick={() => setTaken((t) => (on ? t.filter((x) => x !== ch.id) : [...t, ch.id]))}
                >
                  <span class="hl-check" aria-hidden="true">
                    {on ? '✓' : ''}
                  </span>
                  <b>
                    {ch.name} · +{Math.round(ch.renownBonus * 100)}% renown
                  </b>
                  <small>{ch.rule}</small>
                </button>
              );
            })}
          </div>
        </>
      )}
      <h2>This year</h2>
      <ul class="this-year">
        <li>
          {perks.size}×{perks.size} farm on {content.boards.find((b) => b.id === board)?.name}
        </li>
        <li>{newGame({ seed: 'pack', perks }).actionsLeft} actions a month</li>
        <li>{lean ? 'No coins and no heirlooms to start' : `${content.rules.startCoins + perks.bonusCoins} coins to start`}</li>
        {bonus > 0 && <li>+{Math.round(bonus * 100)}% renown from challenges</li>}
        {tierLift(perks).level > 0 && <li>Level {perks.level}: festival tiers {tierLift(perks).level} points higher</li>}
        {perks.generation > 1 && <li>Generation {perks.generation}: festival tiers {tierLift(perks).generation} points higher</li>}
        {layers > 0 && (
          <li>
            {layers} layer{layers === 1 ? '' : 's'} open below every zone
          </li>
        )}
        {perks.sets.map((id) => {
          const set = content.artifactSets.find((x) => x.id === id)!;
          return (
            <li>
              {set.name}: {set.rule}
            </li>
          );
        })}
        <li>Shop stocks {perks.shop.map(gearName).join(', ')}</li>
        {perks.spawn.length > 0 && <li>Spawn of {perks.spawn.map(name).join(', ')} at the market</li>}
        {perks.autoHarvest && <li>Ripe beds are picked every morning</li>}
      </ul>
      <button class="btn primary big wide" onClick={() => onStart(picked, board, perks.challenges)}>
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
