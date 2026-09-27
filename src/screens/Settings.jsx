import React, { useState } from 'react';
import { Sheet } from '../components/ui.jsx';
import { BoardShapes } from '../components/Dartboard.jsx';
import { BOARDS, THEMES, getLook, setLook } from '../lib/theme.js';

export function SettingsSheet({ onClose, onProfile }) {
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

      <button className="btn btn-ghost" onClick={() => { onClose(); onProfile(); }}>Changer de profil</button>
      <div className="small muted" style={{ textAlign: 'center' }}>Les réglages sont gardés sur ce téléphone.</div>
    </Sheet>
  );
}
