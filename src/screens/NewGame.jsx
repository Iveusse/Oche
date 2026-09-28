import React, { useState } from 'react';
import { Icon, Seg, Switch, Stepper } from '../components/ui.jsx';
import { PlayerOrder, shuffle } from '../components/PlayerOrder.jsx';
import { PlayerPicker } from './Setup.jsx';
import { load, save } from '../lib/store.js';

const MODES = [
  ['x01', 'X01', '301, 501, 701…'],
  ['cricket', 'Cricket', '15 à 20 + bull'],
  ['atc', 'Around the Clock', '1 à 20 dans l\'ordre'],
  ['shanghai', 'Shanghai', '1 numéro par manche'],
];

const DEFAULTS = {
  x01: { start: 501, in: 'single', out: 'single' },
  cricket: { points: true },
  atc: { zones: ['S', 'D', 'T'], order: 'asc', bull: false, skip: false },
  shanghai: { from: 1, to: 7, instantWin: true },
};

function SettingRow({ title, sub, children }) {
  return (
    <div className="between">
      <div className="grow">
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        {sub && <div className="small muted">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

export function NewGame({ players, games, meId, lastPlayedMap, onBack, onStart, onCreatePlayer }) {
  const last = load('lastSetup', null);
  const [mode, setMode] = useState(last?.mode || 'x01');
  const [all, setAll] = useState({ ...DEFAULTS, ...(last?.settings || {}) });
  const [legsToWin, setLegsToWin] = useState(1);
  const [ids, setIds] = useState(() => {
    const base = (last?.ids || []).filter((id) => players.some((p) => p.id === id));
    if (meId && !base.includes(meId)) base.unshift(meId);
    return base;
  });
  const [picker, setPicker] = useState(false);
  const s = all[mode];
  const set = (patch) => setAll({ ...all, [mode]: { ...s, ...patch } });

  const handicap = mode === 'x01' && !!s.handicap;
  const startFor = (id) => Number(s.starts?.[id] ?? s.start);
  const start = () => {
    save('lastSetup', { mode, settings: all, ids });
    const { handicap: h, starts, ...rest } = s;
    const settings = mode === 'x01' && h ? { ...rest, starts: Object.fromEntries(ids.map((id) => [id, startFor(id)])) } : rest;
    onStart({ mode, settings, playerIds: ids, legsToWin });
  };

  return (
    <div className="screen">
      <div className="row">
        <button className="icon-btn" aria-label="Retour" onClick={onBack}><Icon.Back /></button>
        <div className="h2">Nouvelle partie</div>
      </div>

      <div className="col">
        <div className="label">Mode</div>
        <div className="grid2">
          {MODES.map(([k, t, d]) => (
            <button key={k} className={`choice ${mode === k ? 'on' : ''}`} onClick={() => setMode(k)} aria-pressed={mode === k}>
              <div className="t">{t}</div><div className="d">{d}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="label">Réglages {MODES.find((m) => m[0] === mode)[1]}</div>

        {mode === 'x01' && (<>
          <SettingRow title="Départ"><Seg options={[[301, '301'], [501, '501'], [701, '701']]} value={s.start} onChange={(v) => set({ start: v })} /></SettingRow>
          <SettingRow title="Entrée"><Seg options={[['single', 'Simple'], ['double', 'Double'], ['master', 'Master']]} value={s.in} onChange={(v) => set({ in: v })} /></SettingRow>
          <SettingRow title="Sortie"><Seg options={[['single', 'Simple'], ['double', 'Double'], ['master', 'Master']]} value={s.out} onChange={(v) => set({ out: v })} /></SettingRow>
          <SettingRow title="Handicap" sub="Un score de départ différent par joueur (ex. 301 pour les kids, 501 pour les grands)"><Switch on={!!s.handicap} onChange={(v) => set({ handicap: v })} label="Handicap" /></SettingRow>
          <SettingRow title="Premier à"><Stepper value={legsToWin} onChange={setLegsToWin} max={11} label="de legs" format={(v) => `${v} leg${v > 1 ? 's' : ''}`} /></SettingRow>
        </>)}

        {mode === 'cricket' && (
          <SettingRow title="Avec points" sub="Les marques en plus sur un numéro fermé rapportent des points"><Switch on={s.points !== false} onChange={(v) => set({ points: v })} label="Avec points" /></SettingRow>
        )}

        {mode === 'atc' && (<>
          <div className="col">
            <span style={{ fontSize: 14, fontWeight: 600 }}>Zones qui valident un numéro</span>
            <div className="row" style={{ gap: 8 }}>
              {[['S', 'Simple'], ['D', 'Double'], ['T', 'Triple']].map(([z, l]) => {
                const on = s.zones.includes(z);
                return (
                  <button key={z} className={`chip-toggle ${on ? 'on' : ''}`} aria-pressed={on}
                    onClick={() => { const zones = on ? s.zones.filter((x) => x !== z) : [...s.zones, z]; if (zones.length) set({ zones }); }}>
                    {on && <Icon.Check style={{ color: 'var(--accent)' }} />}{l}
                  </button>
                );
              })}
            </div>
            <span className="small muted">Coche 1, 2 ou les 3.</span>
          </div>
          <div className="col">
            <span style={{ fontSize: 14, fontWeight: 600 }}>Parcours</span>
            <Seg options={[['asc', '1 → 20'], ['desc', '20 → 1'], ['random', 'Aléatoire']]} value={s.order} onChange={(v) => set({ order: v })} />
          </div>
          <SettingRow title="Finir par le bull" sub="Après le dernier numéro, il faut toucher le centre"><Switch on={s.bull} onChange={(v) => set({ bull: v })} label="Finir par le bull" /></SettingRow>
          <SettingRow title="Double et triple font sauter des cases" sub="D3 = avance de 2, T3 = avance de 3"><Switch on={s.skip} onChange={(v) => set({ skip: v })} label="Sauts" /></SettingRow>
        </>)}

        {mode === 'shanghai' && (<>
          <div className="col">
            <span style={{ fontSize: 14, fontWeight: 600 }}>Numéros joués (1 manche par numéro)</span>
            <div className="row" style={{ gap: 6 }}>
              {[[1, 7], [1, 10], [1, 20]].map(([a, b]) => {
                const on = s.from === a && s.to === b;
                return <button key={b} className={`chip-toggle ${on ? 'on' : ''}`} style={{ height: 40 }} onClick={() => set({ from: a, to: b })}>{a} à {b}</button>;
              })}
            </div>
            <div className="between card compact" style={{ background: 'var(--bg)', padding: '6px 8px 6px 12px' }}>
              <span className="small" style={{ color: 'var(--text-2)' }}>Perso</span>
              <div className="row" style={{ gap: 4 }}>
                <span className="small muted">de</span>
                <Stepper value={s.from} min={1} max={s.to} onChange={(v) => set({ from: v })} label="début" />
                <span className="small muted">à</span>
                <Stepper value={s.to} min={s.from} max={20} onChange={(v) => set({ to: v })} label="fin" />
              </div>
            </div>
          </div>
          <SettingRow title="Shanghai = victoire immédiate" sub="Simple + double + triple du numéro dans le même tour"><Switch on={s.instantWin !== false} onChange={(v) => set({ instantWin: v })} label="Shanghai victoire immédiate" /></SettingRow>
        </>)}
      </div>

      <div className="col">
        <div className="between">
          <span className="label">Joueurs</span>
          <span className="small muted">glisse pour changer l'ordre</span>
        </div>
        <PlayerOrder ids={ids} players={players} meId={meId} onChange={setIds} />
        {handicap && ids.length > 0 && (
          <div className="panel" style={{ gap: 8 }}>
            <div className="label">Départ de chacun</div>
            {ids.map((id) => (
              <div key={id} className="between">
                <span style={{ fontWeight: 600 }}>{players.find((p) => p.id === id)?.name}</span>
                <Stepper value={startFor(id)} min={101} max={1001} step={100} label={`départ ${players.find((p) => p.id === id)?.name}`}
                  onChange={(v) => set({ starts: { ...(s.starts || {}), [id]: v } })} />
              </div>
            ))}
            <span className="small muted">Les records et succès « 301 en X fléchettes » comptent le départ de chaque joueur.</span>
          </div>
        )}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-dashed grow" onClick={() => setPicker(true)}><Icon.Plus />Ajouter</button>
          <button className="btn btn-sky grow" disabled={ids.length < 2} onClick={() => setIds(shuffle(ids))}><Icon.Shuffle />Ordre aléatoire</button>
        </div>
      </div>

      <button className="btn btn-primary" style={{ marginTop: 'auto' }} disabled={ids.length === 0} onClick={start}>
        {ids.length === 0 ? 'Ajoute au moins un joueur' : 'Lancer la partie'}
      </button>

      {picker && (
        <PlayerPicker
          players={players} games={games} selected={ids} lastPlayedMap={lastPlayedMap}
          onClose={() => setPicker(false)}
          onDone={(sel) => { setIds([...ids.filter((x) => sel.includes(x)), ...sel.filter((x) => !ids.includes(x))]); setPicker(false); }}
          onCreate={onCreatePlayer}
        />
      )}
    </div>
  );
}
