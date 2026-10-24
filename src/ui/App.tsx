import { useState } from 'preact/hooks';
import { heirloomChoices, heirloomSlots, levelFor } from '../core';
import { ArtDefs } from './art';
import { Game } from './Game';
import { Almanac, Pack } from './Progress';
import { HowTo, Journal, Title } from './Screens';
import { useStore } from './store';

type View = 'title' | 'game' | 'journal' | 'help' | 'almanac' | 'pack';

export function App() {
  const store = useStore();
  const [view, setView] = useState<View>('title');
  const [back, setBack] = useState<View>('title');

  const open = (v: View) => {
    setBack(view);
    setView(v);
  };

  /** A story year starts with packing heirlooms once the homestead has slots and there's gear to pack. */
  const beginStory = () => {
    const slots = heirloomSlots(levelFor(store.journal.renown).level);
    if (slots > 0 && heirloomChoices(store.journal).length > 0) {
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
        onStart={(heirlooms) => {
          store.start('story', heirlooms);
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
