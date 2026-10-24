import { useState } from 'preact/hooks';
import { ArtDefs } from './art';
import { Game } from './Game';
import { HowTo, Journal, Title } from './Screens';
import { useStore } from './store';

type View = 'title' | 'game' | 'journal' | 'help';

export function App() {
  const store = useStore();
  const [view, setView] = useState<View>('title');
  const [back, setBack] = useState<View>('title');

  const open = (v: View) => {
    setBack(view);
    setView(v);
  };

  let screen;
  if (view === 'game' && store.game) screen = <Game store={store} onHelp={() => open('help')} onTitle={() => setView('title')} />;
  else if (view === 'journal') screen = <Journal store={store} onBack={() => setView(back)} />;
  else if (view === 'help') screen = <HowTo onBack={() => setView(back)} />;
  else
    screen = (
      <Title
        store={store}
        onStart={(mode) => {
          store.start(mode);
          setView('game');
        }}
        onContinue={() => setView('game')}
        onJournal={() => open('journal')}
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
