import React, { useMemo, useState } from 'react';
import { Sheet } from '../components/ui.jsx';
import { replayed } from '../engine/stats.js';
import { MODE_LABEL, startOf } from '../engine/modes.js';
import { dartLabel } from '../lib/board.js';
import { modeSubtitle } from './Play.jsx';

const f1 = (v) => (v == null ? '-' : v.toFixed(1));
const mins = (ms) => { if (!ms) return null; const m = Math.round(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`; };

// fléchette en bref : au Shanghai S/D/T/R, ailleurs T20, 5, R
function short(mode, d) {
  if (!d.mult) return 'R';
  if (mode === 'shanghai') return d.hit ? (d.mult === 3 ? 'T' : d.mult === 2 ? 'D' : 'S') : 'R';
  if (d.hit === false) return 'R';
  return dartLabel(d);
}

// statistiques de chaque joueur sur toute la partie
function perPlayer(game, legs) {
  const out = {};
  for (const id of game.player_ids) out[id] = { legs: 0, won: 0, darts: 0, pts: 0, high: 0, marks: 0, turns: 0, co: 0, best: null };
  for (const { leg, r } of legs) {
    leg.order.forEach((id, idx) => {
      const s = out[id]; if (!s) return;
      s.legs += 1;
      if (leg.order.length > 1 && leg.ranking?.[0] === id) s.won += 1;
      let legDarts = 0;
      for (const t of r.turns) {
        if (t.p !== idx) continue;
        const pts = t.bust ? 0 : t.darts.reduce((a, d) => a + (d.pts || 0), 0);
        s.darts += t.darts.length; legDarts += t.darts.length; s.pts += pts; s.turns += 1;
        s.high = Math.max(s.high, pts);
        s.marks += t.darts.reduce((a, d) => a + (d.marks || 0), 0);
        if (t.finished && game.mode === 'x01') s.co = Math.max(s.co, t.darts[0].remBefore);
      }
      if (game.mode === 'x01' && leg.ranking?.[0] === id) s.best = s.best == null ? legDarts : Math.min(s.best, legDarts);
      if (game.mode === 'shanghai') s.best = Math.max(s.best ?? 0, r.ps[idx].pts);
    });
  }
  return out;
}

function LegTable({ game, leg, r, byId }) {
  const n = leg.order.length;
  const rounds = [];
  for (const t of r.turns) (rounds[Math.floor(t.nth ?? 0)] ||= Array(n).fill(null))[t.p] = t;
  const x01 = game.mode === 'x01';
  return (
    <div className="gd-table" style={{ gridTemplateColumns: `28px repeat(${n}, minmax(0, 1fr))` }}>
      <span />
      {leg.order.map((id) => <span key={id} className="gd-h">{byId[id]?.name || '?'}</span>)}
      {x01 && (<>
        <span className="gd-r">Dép.</span>
        {leg.order.map((id) => <span key={id} className="gd-c muted">{startOf(game, id)}</span>)}
      </>)}
      {rounds.map((row, i) => (
        <React.Fragment key={i}>
          <span className="gd-r">{i + 1}</span>
          {row.map((t, j) => {
            if (!t) return <span key={j} className="gd-c" />;
            const pts = t.bust ? 0 : t.darts.reduce((a, d) => a + (d.pts || 0), 0);
            const main = x01 ? (t.bust ? 'bust' : t.finished ? '✓' : t.darts[0].remBefore - pts)
              : game.mode === 'cricket' ? t.darts.reduce((a, d) => a + (d.marks || 0), 0) : pts;
            return (
              <span key={j} className={`gd-c ${t.finished ? 'fin' : ''} ${t.bust ? 'bust' : ''}`}>
                <b>{main}</b>
                <small>{x01 && !t.bust ? `${pts} · ` : ''}{t.darts.map((d) => short(game.mode, d)).join(' ')}</small>
              </span>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

export function GameDetail({ game, players, onClose }) {
  const byId = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);
  const legs = useMemo(() => replayed(game).filter(({ leg }) => leg.done), [game]);
  const stats = useMemo(() => perPlayer(game, legs), [game, legs]);
  const [open, setOpen] = useState(legs.length === 1 ? 0 : -1);
  const active = legs.reduce((a, { leg }) => a + (leg.activeMs || 0), 0);
  const d = new Date(game.created_at);
  const ids = [...game.player_ids].sort((a, b) => stats[b].won - stats[a].won);
  const x01 = game.mode === 'x01'; const sh = game.mode === 'shanghai'; const cr = game.mode === 'cricket';

  return (
    <Sheet onClose={onClose} label="Détail de la partie">
      <div className="between">
        <div>
          <div className="h2">{x01 ? `${game.settings.start}` : MODE_LABEL[game.mode]}</div>
          <div className="small muted">{modeSubtitle({ ...game, data: { ...game.data, legs: game.data.legs.slice(0, 1) } }).replace(/ · Leg \d+$/, '')}</div>
        </div>
        <button style={{ color: 'var(--accent)', fontWeight: 700, minHeight: 44 }} onClick={onClose}>OK</button>
      </div>
      <div className="small muted">
        {d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        {' · '}{legs.length} leg{legs.length > 1 ? 's' : ''}{mins(active) ? ` · ${mins(active)} de jeu` : ''}
      </div>

      <div className="gd-players">
        {ids.map((id, i) => {
          const s = stats[id];
          return (
            <div key={id} className={`gd-player ${i === 0 && legs.length ? 'first' : ''}`}>
              <div className="between">
                <b>{byId[id]?.name || '?'}</b>
                {game.player_ids.length > 1 && <span className="gd-won">{s.won} leg{s.won > 1 ? 's' : ''}</span>}
              </div>
              <div className="gd-kpis">
                {x01 && <><span>Moy. <b>{s.darts ? f1((s.pts / s.darts) * 3) : '-'}</b></span><span>Meilleur tour <b>{s.high || '-'}</b></span><span>Finish <b>{s.co || '-'}</b></span><span>Leg le + court <b>{s.best ?? '-'}</b></span></>}
                {sh && <><span>Points <b>{s.pts}</b></span><span>Meilleur tour <b>{s.high || '-'}</b></span></>}
                {cr && <><span>MPR <b>{s.turns ? (s.marks / s.turns).toFixed(2) : '-'}</b></span><span>Marques <b>{s.marks}</b></span></>}
                <span>Fléchettes <b>{s.darts}</b></span>
              </div>
            </div>
          );
        })}
      </div>

      {legs.map(({ leg, r }, i) => (
        <div key={i} className="panel" style={{ gap: 8 }}>
          <button className="between" style={{ width: '100%', minHeight: 36, textAlign: 'left' }} onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
            <span><b>Leg {i + 1}</b> <span className="small muted">· {leg.order.length > 1 ? `${byId[leg.ranking?.[0]]?.name || '?'} gagne` : 'terminé'}{leg.stoppedAt != null ? ' (arrêté avant la fin)' : ''}</span></span>
            <span className="small" style={{ color: 'var(--accent)', fontWeight: 700 }}>{open === i ? 'Masquer' : 'Voir les tours'}</span>
          </button>
          {open === i && <LegTable game={game} leg={leg} r={r} byId={byId} />}
        </div>
      ))}
      {!legs.length && <div className="muted small">Partie arrêtée avant la fin du premier leg.</div>}
    </Sheet>
  );
}
