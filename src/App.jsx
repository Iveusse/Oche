import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { addPlayer, fetchGames, fetchPlayers, flushPending, getCode, saveGame, setCode } from './lib/api.js';
import { load, save, uuid, PLAYER_COLORS } from './lib/store.js';
import { atcTargets, checkoutTargets, isTraining } from './engine/modes.js';
import { lastPlayed } from './engine/stats.js';
import { TabBar } from './components/ui.jsx';
import { CodeScreen, ProfileScreen } from './screens/Setup.jsx';
import { NewGame } from './screens/NewGame.jsx';
import { Play } from './screens/Play.jsx';
import { Home, Ranking, Stats, Training, trainingRecords } from './screens/Tabs.jsx';

function newLeg(mode, settings, order) {
  const leg = { order, darts: [], validated: 0, continueForPlaces: null };
  if (mode === 'atc') leg.targets = atcTargets(settings);
  if (mode === 'train-doubles') leg.targets = atcTargets({ order: 'asc', bull: true });
  if (mode === 'train-checkout') leg.targets = checkoutTargets();
  return leg;
}

const upsert = (list, g) => {
  const i = list.findIndex((x) => x.id === g.id);
  if (i < 0) return [...list, g];
  const next = [...list]; next[i] = g; return next;
};

export default function App() {
  const [code, setCodeState] = useState(getCode());
  const [meId, setMeId] = useState(load('profile', null));
  const [players, setPlayers] = useState(load('cachePlayers', []));
  const [games, setGames] = useState(load('cacheGames', []));
  const [current, setCurrent] = useState(load('current', null));
  const [view, setView] = useState(() => (load('profile', null) || load('profileSkipped', false) ? 'tabs' : 'profile'));
  const [tab, setTab] = useState('home');
  const [toast, setToast] = useState('');

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2600); };

  const logout = () => { setCode(null); setCodeState(null); };

  const refresh = useCallback(async () => {
    try {
      const left = await flushPending();
      const [ps, gs] = await Promise.all([fetchPlayers(), fetchGames()]);
      setPlayers(ps); save('cachePlayers', ps);
      // les parties en attente d'envoi restent visibles
      const pending = Object.values(load('pending', {}));
      let merged = gs;
      for (const g of pending) merged = upsert(merged, g);
      setGames(merged); save('cacheGames', merged);
      if (left) flash('Hors ligne : sauvegarde en attente');
    } catch (e) {
      if (e.badCode) logout();
      else flash('Connexion impossible, données locales affichées');
    }
  }, []);

  useEffect(() => { if (code) refresh(); }, [code, refresh]);

  const me = players.find((p) => p.id === meId) || null;
  const lastPlayedMap = useMemo(() => lastPlayed(games), [games]);
  const records = useMemo(() => (me ? trainingRecords(games, me.id) : {}), [games, me]);

  const setCur = (g) => { setCurrent(g); save('current', g); };

  const persist = async (g) => {
    setGames((gs) => { const n = upsert(gs, g); save('cacheGames', n); return n; });
    try {
      await saveGame(g);
      const left = Object.keys(load('pending', {})).length;
      if (left) flash('Hors ligne : sauvegarde en attente');
    } catch (e) {
      if (e.badCode) logout();
    }
  };

  const createPlayer = async (name) => {
    const color = PLAYER_COLORS[players.length % PLAYER_COLORS.length];
    const p = await addPlayer(name, color);
    setPlayers((ps) => { const n = [...ps, p].sort((a, b) => a.name.localeCompare(b.name)); save('cachePlayers', n); return n; });
    return p;
  };

  const pickProfile = (id) => { setMeId(id); save('profile', id); setView('tabs'); };

  const begin = ({ mode, settings, playerIds, legsToWin = 1 }, force = false) => {
    if (!force && current && !confirm('Une partie est déjà en cours. La remplacer ? (les legs terminés sont gardés)')) return;
    if (!force && current) endGame(current, { abandon: true, silent: true });
    const g = {
      id: uuid(), mode, settings, player_ids: playerIds, created_at: new Date().toISOString(),
      status: 'in_progress', data: { legs: [newLeg(mode, settings, playerIds)], legsToWin },
    };
    setCur(g);
    setView('play');
  };

  const startTraining = (mode) => {
    if (!me) { setView('profile'); return; }
    begin({ mode, settings: {}, playerIds: [me.id] });
  };

  const onLegDone = (g) => {
    if (isTraining(g.mode)) {
      const g2 = { ...g, status: 'finished' };
      setCur(g2); persist(g2);
    } else {
      setCur(g); persist(g);
    }
  };

  const endGame = (g, opts = {}) => {
    const legs = g.data.legs;
    const last = legs[legs.length - 1];
    let final = null;
    if (opts.stopTraining) {
      if (!last.darts.length) { setCur(null); setView('tabs'); setTab('training'); return; }
      final = { ...g, status: 'finished', data: { ...g.data, legs: [{ ...last, done: true, ranking: last.order }] } };
      setCur(final); persist(final);
      return; // l'écran de fin d'entraînement s'affiche
    }
    if (opts.abandon) {
      const done = legs.filter((l) => l.done);
      if (done.length) final = { ...g, status: 'finished', data: { ...g.data, legs: done } };
    } else {
      final = { ...g, status: 'finished', data: { ...g.data, legs: legs.filter((l) => l.done) } };
    }
    if (final) persist(final);
    setCur(null);
    if (opts.silent) return;
    if (opts.replay) { begin({ mode: g.mode, settings: g.settings, playerIds: g.player_ids, legsToWin: g.data.legsToWin }, true); return; }
    setView('tabs');
    setTab(isTraining(g.mode) ? 'training' : 'home');
  };

  if (!code) return <CodeScreen onOk={(c) => { setCode(c); setCodeState(c); }} />;

  if (view === 'profile') {
    return (
      <ProfileScreen
        players={players} meId={meId} onPick={pickProfile} onCreate={createPlayer}
        onSkip={() => { save('profileSkipped', true); setView('tabs'); }}
      />
    );
  }

  if (view === 'new') {
    return (
      <NewGame
        players={players} games={games} meId={meId} lastPlayedMap={lastPlayedMap}
        onBack={() => setView('tabs')} onStart={begin} onCreatePlayer={createPlayer}
      />
    );
  }

  if (view === 'play' && current) {
    return (
      <Play
        game={current} players={players} records={records}
        onUpdate={setCur} onLegDone={onLegDone} onEnd={endGame}
        onExit={() => { setView('tabs'); setTab('home'); }}
      />
    );
  }

  return (
    <>
      {tab === 'home' && (
        <Home me={me} players={players} games={games} current={current}
          onNew={() => setView('new')} onResume={() => setView('play')}
          onProfile={() => setView('profile')} goRanking={() => setTab('ranking')} />
      )}
      {tab === 'training' && (
        <Training me={me} games={games} onStart={startTraining} onProfile={() => setView('profile')}
          onAtc={() => begin({ mode: 'atc', settings: { zones: ['S', 'D', 'T'], order: 'asc', bull: false, skip: false, ...(load('lastSetup', null)?.settings?.atc || {}) }, playerIds: [me.id] })} />
      )}
      {tab === 'stats' && <Stats me={me} players={players} games={games} />}
      {tab === 'ranking' && <Ranking me={me} players={players} games={games} />}
      <TabBar tab={tab} onTab={(t) => { setTab(t); window.scrollTo(0, 0); if (t !== 'home') refresh(); }} />
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
