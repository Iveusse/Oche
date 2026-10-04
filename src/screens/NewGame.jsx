import React, { useState, useMemo } from 'react';
import { Icon, Seg, Switch, Stepper } from '../components/ui.jsx';
import { PlayerOrder, shuffle } from '../components/PlayerOrder.jsx';
import { PlayerPicker } from './Setup.jsx';
import { load, save } from '../lib/store.js';
import { winProbs, balanceStarts } from '../engine/winprob.js';

const MODES = [
  ['x01', 'X01', '301, 501, 701…'],
  ['cricket', 'Cricket', '15 à 20 + bull'],
  ['atc', 'Around the Clock', '1 à 20 dans l\'ordre'],
  ['shanghai', 'Shanghai', '1 numéro par manche'],
  ['baseball', 'Baseball', '9 manches, 1 à 3 points'],
  ['killer', 'Killer', 'élimine les autres'],
  ['countup', 'Count Up', 'fais le plus gros total'],
];

const DEFAULTS = {
  x01: { start: 501, in: 'single', out: 'single' },
  cricket: { points: true },
  atc: { zones: ['S', 'D', 'T'], order: 'asc', bull: false, skip: false },
  shanghai: { from: 1, to: 7, instantWin: true },
  baseball: {},
  killer: { lives: 3 },
  countup: { rounds: 8 },
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

export function NewGame({ hidden = [], onToggleHidden, players, games, meId, lastPlayedMap, onBack, onStart, onCreatePlayer }) {
  const last = load('lastSetup', null);
  const [mode, setMode] = useState(last?.mode || 'x01');
  const [all, setAll] = useState({ ...DEFAULTS, ...(last?.settings || {}) });
  const [legsToWin, setLegsToWin] = useState(1);
  const [ids, setIds] = useState(() => {
    const base = (last?.ids || []).filter((id) => players.some((p) => p.id === id) && (id === meId || !hidden.includes(id)));
    if (meId && !base.includes(meId)) base.unshift(meId);
    return base;
  });
  const [picker, setPicker] = useState(false);
  const s = all[mode];
  const set = (patch) => setAll({ ...all, [mode]: { ...s, ...patch } });

  const handicap = mode === 'x01' && !!s.handicap;
  const startFor = (id) => Number(s.starts?.[id] ?? s.start);
  const effSettings = useMemo(() => {
    if (mode !== 'x01' || !s.handicap) return s;
    return { ...s, starts: Object.fromEntries(ids.map((id) => [id, startFor(id)])) };
  }, [mode, s, ids]); // eslint-disable-line
  const wp = useMemo(() => {
    try { return winProbs(mode, effSettings, ids, games || [], legsToWin); } catch { return { ok: false, probs: {}, missing: [] }; }
  }, [mode, effSettings, ids, games, legsToWin]);
  const nameOf = (id) => players.find((p) => p.id === id)?.name || '?';
  const balance = () => {
    const st = balanceStarts(ids, s, games || [], legsToWin);
    if (st) set({ handicap: true, starts: st });
  };
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
        <select className="input" style={{ fontWeight: 800, fontSize: 16 }} value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Mode de jeu">
          {MODES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
        <div className="small muted" style={{ lineHeight: 1.4 }}>{MODES.find((m) => m[0] === mode)[2]}</div>
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

        {mode === 'baseball' && (
          <div className="small muted" style={{ lineHeight: 1.45 }}>9 manches : la manche N se joue sur le numéro N. Simple = 1 point, double = 2, triple = 3. Le plus de points après 9 manches gagne.</div>
        )}

        {mode === 'countup' && (<>
          <SettingRow title="Manches" sub="3 fléchettes par manche, on additionne tout"><Stepper value={s.rounds || 8} min={1} max={20} onChange={(v) => set({ rounds: v })} label="manches" format={(v) => `${v} manche${v > 1 ? 's' : ''}`} /></SettingRow>
          <SettingRow title="Premier à"><Stepper value={legsToWin} onChange={setLegsToWin} max={11} label="de legs" format={(v) => `${v} leg${v > 1 ? 's' : ''}`} /></SettingRow>
        </>)}

        {mode === 'killer' && (<>
          <SettingRow title="Vies de départ" sub="Chaque double sur ton numéro en retire une"><Stepper value={s.lives || 3} min={1} max={5} onChange={(v) => set({ lives: v })} label="vies" format={(v) => `${v} vie${v > 1 ? 's' : ''}`} /></SettingRow>
          <SettingRow title="Premier à"><Stepper value={legsToWin} onChange={setLegsToWin} max={11} label="de legs" format={(v) => `${v} leg${v > 1 ? 's' : ''}`} /></SettingRow>
          <div className="small muted" style={{ lineHeight: 1.45 }}>Un numéro est tiré au hasard pour chacun. Touche le double de ton numéro pour devenir killer, puis vise les doubles des autres pour leur retirer des vies. Le dernier en vie gagne. À 2 joueurs minimum.</div>
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

      {ids.length >= 2 ? (
        <div className="panel" style={{ gap: 8 }}>
          <div className="label">Qui va gagner ?</div>
          {wp.ok ? (<>
            {[...ids].sort((a, b) => wp.probs[b] - wp.probs[a]).map((id) => (
              <div key={id} className="col" style={{ gap: 3 }}>
                <div className="between"><span style={{ fontWeight: 600 }}>{nameOf(id)}</span><span style={{ fontWeight: 800 }}>{Math.round(wp.probs[id] * 100)} %</span></div>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--bg)', overflow: 'hidden' }}><div style={{ width: `${Math.max(2, wp.probs[id] * 100)}%`, height: '100%', background: 'var(--accent)' }} /></div>
              </div>
            ))}
            <span className="small muted">Estimation d'après vos parties passées{wp.approx ? ' (peu de données, c\'est approximatif)' : ''}.</span>
            {mode === 'x01' && (
              <button className="btn btn-sky" onClick={balance}>Équilibrer avec un handicap</button>
            )}
          </>) : (
            <span className="small muted">{wp.missing?.length ? `Pas assez de données pour ${wp.missing.map(nameOf).join(', ')} (il faut ${wp.need || 'quelques parties'}).` : 'Pas d\'estimation pour ce réglage.'}</span>
          )}
        </div>
      ) : null}

      <div className="start-bar"><button className="btn btn-primary" style={{ width: '100%' }} disabled={ids.length === 0 || (mode === 'killer' && ids.length < 2)} onClick={start}>
        {ids.length === 0 ? 'Ajoute au moins un joueur' : mode === 'killer' && ids.length < 2 ? 'Le Killer se joue à 2 minimum' : 'Lancer la partie'}
      </button></div>

      {picker && (
        <PlayerPicker
          players={players} games={games} selected={ids} lastPlayedMap={lastPlayedMap} hidden={hidden} onToggleHidden={onToggleHidden} meId={meId}
          onClose={() => setPicker(false)}
          onDone={(sel) => { setIds([...ids.filter((x) => sel.includes(x)), ...sel.filter((x) => !ids.includes(x))]); setPicker(false); }}
          onCreate={onCreatePlayer}
        />
      )}
    </div>
  );
}
