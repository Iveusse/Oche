import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { addPlayer, clearLegacyCode, dropTeam, fetchGames, fetchPlayers, flushPending, getCode, getTeamId, getTeams, joinTeam, legacyCode, patchTeam, rememberTeam, resetPlayer, saveGame, setTeamId } from './lib/api.js';
import { adoptLegacy, forgetTeam, load, save, setScope, uuid, PLAYER_COLORS } from './lib/store.js';
import { atcTargets, checkoutTargets, isTraining } from './engine/modes.js';
import { lastPlayed, setResets } from './engine/stats.js';
import { TabBar } from './components/ui.jsx';
import { ProfileScreen } from './screens/Setup.jsx';
import { TeamSheet, Welcome } from './screens/Teams.jsx';
import { NewGame } from './screens/NewGame.jsx';
import { Play } from './screens/Play.jsx';
import { Home, Ranking, Stats, Training, trainingRecords } from './screens/Tabs.jsx';
import { generateDemo } from './lib/demo.js';

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

// ---------- racine : choix de l'équipe ----------
export default function App() {
  const [teamId, setTid] = useState(getTeamId);
  const [, bump] = useState(0);
  const [legacy, setLegacy] = useState(() => (!getTeamId() && legacyCode() ? 'wait' : null));
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(false);

  // ancienne version (un seul code de groupe) : on retrouve l'équipe et on y range les données du téléphone
  useEffect(() => {
    if (legacy !== 'wait') return;
    joinTeam(legacyCode()).then((t) => {
      if (t) { adoptLegacy(t.id); rememberTeam({ id: t.id, name: t.name, code: legacyCode() }); setTid(t.id); }
      clearLegacyCode(); setLegacy(null);
    }).catch(() => setLegacy('error'));
  }, [legacy]);

  const choose = (t) => { rememberTeam(t); setAdding(false); setMenu(false); setNotice(''); setTid(t.id); };
  const switchTo = (id) => { setTeamId(id); setMenu(false); setTid(id); window.scrollTo(0, 0); };
  const leave = (id) => { forgetTeam(id); dropTeam(id); setMenu(false); setTid(getTeamId()); };
  const invalid = (id) => {
    const t = getTeams().find((x) => x.id === id);
    dropTeam(id);
    setNotice(`Le code de l'équipe « ${t?.name || ''} » a changé. Demande le nouveau à un membre de l'équipe.`);
    setTid(getTeamId());
  };

  if (legacy) {
    return (
      <div className="screen" style={{ paddingTop: 'calc(72px + var(--safe-top))' }}>
        <div className="h1" style={{ fontSize: 34 }}>Oche</div>
        {legacy === 'wait' ? <div className="muted">Mise à jour de ton équipe…</div> : (<>
          <div className="muted" style={{ lineHeight: 1.45 }}>Impossible de joindre le serveur pour passer à la nouvelle version. Vérifie ta connexion.</div>
          <button className="btn btn-primary" onClick={() => setLegacy('wait')}>Réessayer</button>
        </>)}
      </div>
    );
  }
  const team = getTeams().find((t) => t.id === teamId);
  if (!team || adding) return <Welcome notice={notice} onTeam={choose} onCancel={team ? () => setAdding(false) : null} />;
  setScope(team.id);
  return (<>
    <TeamApp key={team.id} team={team} onTeams={() => setMenu(true)} onInvalid={() => invalid(team.id)} onRenamed={() => bump((n) => n + 1)} />
    {menu && (
      <TeamSheet team={team} teams={getTeams()} onSwitch={switchTo} onAdd={() => { setMenu(false); setAdding(true); }}
        onLeave={leave} onClose={() => setMenu(false)} onChanged={() => bump((n) => n + 1)} />
    )}
  </>);
}

// ---------- l'appli d'une équipe (remontée à chaque changement d'équipe) ----------
function TeamApp({ team, onTeams, onInvalid, onRenamed }) {
  const code = team.code;
  const [meId, setMeId] = useState(load('profile', null));
  const [players, setPlayers] = useState(load('cachePlayers', []));
  const [games, setGames] = useState(load('cacheGames', []));
  const [current, setCurrent] = useState(load('current', null));
  const [view, setView] = useState(() => (load('profile', null) || load('profileSkipped', false) ? 'tabs' : 'profile'));
  const [tab, setTab] = useState('home');
  const [toast, setToast] = useState('');
  const [demo, setDemoState] = useState(load('demo', false));
  const [demoData, setDemoData] = useState(null);
  const setDemo = (v) => { setDemoState(v); save('demo', v); if (!v) setDemoData(null); };
  useEffect(() => {
    if (!demo || demoData) return undefined;
    const t = setTimeout(() => setDemoData(generateDemo()), 60);
    return () => clearTimeout(t);
  }, [demo, demoData]);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2600); };

  const logout = () => onInvalid();

  const refresh = useCallback(async () => {
    try {
      const left = await flushPending();
      const [ps, gs, info] = await Promise.all([fetchPlayers(), fetchGames(), joinTeam(getCode()).catch(() => undefined)]);
      if (info && info.name !== team.name) { patchTeam(team.id, { name: info.name }); onRenamed(); }
      setPlayers(ps); save('cachePlayers', ps);
      // les parties en attente d'envoi restent visibles
      const pending = Object.values(load('pending', {})).filter((g) => !g.__code || g.__code === getCode()).map(({ __code, updated, ...g }) => g);
      let merged = gs;
      for (const g of pending) merged = upsert(merged, g);
      setGames(merged); save('cacheGames', merged);
      // partie en cours perdue sur ce téléphone (réinstallation, autre appareil) : on la récupère du serveur
      if (!load('current', null)) {
        const week = Date.now() - 7 * 86400000;
        const live = merged
          .filter((g) => g.status === 'in_progress' && new Date(g.updated_at || g.created_at).getTime() > week)
          .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))[0];
        if (live) { setCurrent(live); save('current', live); }
      }
      if (left) flash('Hors ligne : sauvegarde en attente');
    } catch (e) {
      if (e.badCode) logout();
      else flash('Hors ligne : tout est gardé et sera envoyé au retour du réseau');
    }
  }, []);

  useEffect(() => { if (code) refresh(); }, [code, refresh]);
  // retour du réseau ou retour dans l'appli : on envoie ce qui attend
  useEffect(() => {
    if (!code) return undefined;
    const onBack = () => { if (navigator.onLine && document.visibilityState === 'visible') refresh(); };
    window.addEventListener('online', onBack);
    document.addEventListener('visibilitychange', onBack);
    return () => { window.removeEventListener('online', onBack); document.removeEventListener('visibilitychange', onBack); };
  }, [code, refresh]);

  setResets(players);
  const [statsKey, setStatsKey] = useState(0);
  const onResetPlayer = async (code, pid) => {
    const at = await resetPlayer(code, pid);
    setPlayers((ps) => { const n = ps.map((p) => (p.id === pid ? { ...p, reset_at: at } : p)); save('cachePlayers', n); return n; });
    setStatsKey((k) => k + 1);
  };
  const me = players.find((p) => p.id === meId) || null;
  const played = useMemo(() => games.filter((g) => g.data?.legs?.some((l) => l.done)), [games]);
  const lastPlayedMap = useMemo(() => lastPlayed(played), [played]);
  const statPlayers = useMemo(() => (demo && demoData ? [...players, ...demoData.players] : players), [players, demo, demoData]);
  const statGames = useMemo(() => (demo && demoData ? [...played, ...demoData.games] : played), [played, demo, demoData]);
  const records = useMemo(() => (me ? trainingRecords(played, me.id) : {}), [played, me]);

  const setCur = (g) => { setCurrent(g); save('current', g); };

  // Chaque tour validé part aussi sur le serveur : la partie en cours survit à une réinstallation
  // et peut être reprise depuis un autre téléphone.
  const updateGame = (g) => {
    const prev = current;
    setCur(g);
    const lp = prev?.data.legs; const lg = g.data.legs;
    const validatedChanged = !lp || lp.length !== lg.length || (lp[lp.length - 1].validated || 0) !== (lg[lg.length - 1].validated || 0)
      || lp[lp.length - 1].continueForPlaces !== lg[lg.length - 1].continueForPlaces;
    if (validatedChanged) persist({ ...g, updated_at: new Date().toISOString() });
  };

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
    persist(g);
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
      if (!last.darts.length) { persist({ ...g, status: 'finished', data: { ...g.data, legs: [] } }); setCur(null); setView('tabs'); setTab('training'); return; }
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
    // rien de joué : on clôt quand même la partie côté serveur pour qu'elle ne revienne pas
    persist(final || { ...g, status: 'finished', data: { ...g.data, legs: [] } });
    setCur(null);
    if (opts.silent) return;
    if (opts.replay) { begin({ mode: g.mode, settings: g.settings, playerIds: g.player_ids, legsToWin: g.data.legsToWin }, true); return; }
    setView('tabs');
    setTab(isTraining(g.mode) ? 'training' : 'home');
  };

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
        game={current} players={players} records={records} history={played}
        onUpdate={updateGame} onLegDone={onLegDone} onEnd={endGame}
        onExit={() => { setView('tabs'); setTab('home'); }}
      />
    );
  }

  return (
    <>
      {tab === 'home' && (
        <Home me={me} players={players} games={played} current={current} team={team} onTeams={onTeams}
          onNew={() => setView('new')} onResume={() => setView('play')}
          onProfile={() => setView('profile')} goRanking={() => setTab('ranking')} demo={demo} onDemo={setDemo} onResetPlayer={onResetPlayer} />
      )}
      {tab === 'training' && (
        <Training me={me} games={played} onStart={startTraining} onProfile={() => setView('profile')}
          onAtc={() => begin({ mode: 'atc', settings: { zones: ['S', 'D', 'T'], order: 'asc', bull: false, skip: false, ...(load('lastSetup', null)?.settings?.atc || {}) }, playerIds: [me.id] })} />
      )}
      {demo && (tab === 'stats' || tab === 'ranking') && (
        <div style={{ maxWidth: 520, margin: '0 auto', padding: 'calc(12px + var(--safe-top)) 16px 0' }}>
          <div className="demo-banner" role="status">
            {demoData ? <><b>Mode démo</b> : Testeur, Bot Pote et Bot Costaud sont simulés sur 6 mois. Rien n'est enregistré. À couper dans les réglages.</> : 'Mode démo : génération de 6 mois de parties…'}
          </div>
        </div>
      )}
      {tab === 'stats' && <Stats key={`st${statsKey}`} me={me} players={statPlayers} games={statGames} />}
      {tab === 'ranking' && <Ranking key={`rk${statsKey}`} me={me} players={statPlayers} games={statGames} />}
      <TabBar tab={tab} onTab={(t) => { setTab(t); window.scrollTo(0, 0); if (t !== 'home') refresh(); }} />
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
