import { useErrorBoundary, useState } from 'preact/hooks';
import { boardsFor, heirloomChoices, heirloomSlots, levelFor } from '../core';
import { ArtDefs } from './art';
import { Game } from './Game';
import { Almanac, Pack } from './Progress';
import { HowTo, Journal, Title } from './Screens';
import { clearSave, useStore } from './store';

type View = 'title' | 'game' | 'journal' | 'help' | 'almanac' | 'pack';

/** If anything throws while rendering, show a way out instead of a blank page. */
export function App() {
  const [error, reset] = useErrorBoundary((e) => console.error(e));
  if (error) return <Crash error={error} onRetry={reset} />;
  return <Main />;
}

function Crash({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div class="app">
      <div class="screen crash paper">
        <h1>Something went wrong</h1>
        <p>The game hit an error it couldn't recover from. Your field journal and homestead progress are safe.</p>
        <pre class="crash-detail">{String((error as Error)?.message ?? error)}</pre>
        <div class="col">
          <button class="btn primary big" onClick={() => location.reload()}>
            Reload
          </button>
          <button class="btn" onClick={onRetry}>
            Try again
          </button>
          <button
            class="btn ghost"
            onClick={() => {
              clearSave();
              location.reload();
            }}
          >
            Abandon this year's save
          </button>
        </div>
      </div>
    </div>
  );
}

function Main() {
  const store = useStore();
  const [view, setView] = useState<View>('title');
  const [back, setBack] = useState<View>('title');

  const open = (v: View) => {
    setBack(view);
    setView(v);
  };

  /** A story year starts by choosing a board and packing heirlooms, when there's a choice to make. */
  const beginStory = () => {
    const slots = heirloomSlots(levelFor(store.journal.renown).level);
    if ((slots > 0 && heirloomChoices(store.journal).length > 0) || boardsFor(store.journal).length > 1) {
      open('pack');
      return;
    }
    store.start('story');
    setView('game');
  };

  let screen;
  if (view === 'game' && store.game)
    screen = (
      <Game
        store={store}
        onHelp={() => open('help')}
        onTitle={() => setView('title')}
        onNewYear={beginStory}
        onAlmanac={() => open('almanac')}
      />
    );
  else if (view === 'journal') screen = <Journal store={store} onBack={() => setView(back)} />;
  else if (view === 'help') screen = <HowTo onBack={() => setView(back)} />;
  else if (view === 'almanac') screen = <Almanac store={store} onBack={() => setView(back)} />;
  else if (view === 'pack')
    screen = (
      <Pack
        store={store}
        onBack={() => setView('title')}
        onStart={(heirlooms, board) => {
          store.start('story', heirlooms, board);
          setView('game');
        }}
      />
    );
  else
    screen = (
      <Title
        store={store}
        onStart={(mode) => {
          if (mode === 'story') return beginStory();
          store.start(mode);
          setView('game');
        }}
        onContinue={() => setView('game')}
        onJournal={() => open('journal')}
        onAlmanac={() => open('almanac')}
        onHelp={() => open('help')}
      />
    );

  return (
    <div class="app">
      <ArtDefs />
      {screen}
    </div>
  );
}
