import React, { useState } from 'react';
import { Sheet, Switch } from '../components/ui.jsx';
import { BoardShapes } from '../components/Dartboard.jsx';
import { BOARDS, THEMES, getLook, setLook } from '../lib/theme.js';

function ResetZone({ players, onReset }) {
  const [open, setOpen] = useState(false);
  const [pid, setPid] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const player = players.find((p) => p.id === pid);
  const go = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try { await onReset(code.trim(), pid); setMsg({ ok: true, text: `Le profil de ${player.name} repart de zéro.` }); setCode(''); setPid(''); }
    catch (err) { setMsg({ ok: false, text: err.message }); }
    setBusy(false);
  };
  if (!open) {
    return <button className="small muted" style={{ alignSelf: 'center', minHeight: 36, textDecoration: 'underline' }} onClick={() => setOpen(true)}>Zone sensible</button>;
  }
  return (
    <form className="panel" style={{ border: '1px solid var(--bad)', background: 'var(--card)' }} onSubmit={go}>
      <div style={{ fontWeight: 800, color: 'var(--bad)' }}>Remettre un profil à zéro</div>
      <div className="small" style={{ color: 'var(--text-2)', lineHeight: 1.45 }}>
        Toutes les stats et tous les succès du joueur repartent de zéro. Les parties ne sont pas supprimées : les autres joueurs gardent leurs stats. Impossible à annuler.
      </div>
      <select className="input" value={pid} onChange={(e) => setPid(e.target.value)} aria-label="Joueur à remettre à zéro">
        <option value="">Choisir le joueur…</option>
        {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <input className="input" type="password" autoComplete="off" placeholder="Code du groupe pour confirmer" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Code du groupe pour confirmer" />
      {msg && <div className="small" style={{ color: msg.ok ? 'var(--good)' : 'var(--bad)', fontWeight: 600 }}>{msg.text}</div>}
      <button type="submit" className="btn" disabled={!pid || !code.trim() || busy} style={{ background: 'var(--bad)', color: '#1a0503' }}>
        {busy ? 'Vérification…' : player ? `Remettre ${player.name} à zéro` : 'Remettre à zéro'}
      </button>
      <button type="button" className="small muted" style={{ minHeight: 36 }} onClick={() => { setOpen(false); setMsg(null); }}>Fermer</button>
    </form>
  );
}

export function SettingsSheet({ onClose, onProfile, demo, onDemo, players = [], onResetPlayer }) {
  const [look, setLookState] = useState(getLook());
  const pick = (patch) => { const next = { ...look, ...patch }; setLookState(next); setLook(next); };

  return (
    <Sheet onClose={onClose} label="Réglages">
      <div className="between">
        <span className="h2">Réglages</span>
        <button style={{ color: 'var(--accent)', fontWeight: 700, minHeight: 44 }} onClick={onClose}>OK</button>
      </div>

      <div className="col">
        <span className="label">Thème de l'appli</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
          {THEMES.map(([k, name]) => (
            <button key={k} onClick={() => pick({ theme: k })} aria-pressed={look.theme === k}
              className={`theme-swatch ${look.theme === k ? 'on' : ''}`} style={{ background: 'var(--card)' }}>
              <div data-theme={k} style={{ width: '100%', borderRadius: 10, padding: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ height: 8, width: '70%', borderRadius: 4, background: 'var(--text)' }} />
                <div style={{ height: 18, borderRadius: 6, background: 'var(--accent)' }} />
                <div className="row" style={{ gap: 4 }}>
                  <div style={{ flex: 1, height: 14, borderRadius: 4, background: 'var(--card)' }} />
                  <div style={{ flex: 1, height: 14, borderRadius: 4, background: 'var(--card)' }} />
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="col">
        <span className="label">Couleurs de la cible</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
          {BOARDS.map(([k, name]) => (
            <button key={k} onClick={() => pick({ board: k })} aria-pressed={look.board === k}
              className={`theme-swatch ${look.board === k ? 'on' : ''}`} style={{ background: 'var(--card)' }}>
              <div data-board={k} style={{ width: 76, height: 76, background: 'transparent' }}>
                <svg viewBox="-1.02 -1.02 2.04 2.04" width="76" height="76" aria-hidden="true"><BoardShapes numbers={false} /></svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{name}</span>
            </button>
          ))}
        </div>
        <span className="small muted">"Daltonien" remplace le rouge et le vert par de l'orange et du bleu, plus faciles à distinguer.</span>
      </div>

      <div className="between panel" style={{ background: 'var(--card)', flexDirection: 'row', alignItems: 'center' }}>
        <div className="grow">
          <div style={{ fontWeight: 700 }}>Mode démo</div>
          <div className="small muted" style={{ lineHeight: 1.4 }}>Ajoute un joueur « Testeur » (joueur moyen qui progresse) et deux bots, avec 6 mois de parties simulées, pour voir les stats, l'analyse et les succès. Visible dans Stats et Classement, rien n'est enregistré.</div>
        </div>
        <Switch on={!!demo} onChange={onDemo} label="Mode démo" />
      </div>

      <button className="btn btn-ghost" onClick={() => { onClose(); onProfile(); }}>Changer de profil</button>
      <div className="small muted" style={{ textAlign: 'center' }}>Les réglages sont gardés sur ce téléphone.</div>
      {onResetPlayer && <ResetZone players={players} onReset={onResetPlayer} />}
    </Sheet>
  );
}
