import React, { useEffect, useMemo, useState } from 'react';
import { Icon, Sheet } from '../components/ui.jsx';
import { computeRecap, drawRecap } from '../lib/recap.js';

export function RecapSheet({ games, players, onClose }) {
  const recap = useMemo(() => computeRecap(games, players), [games, players]);
  const [img, setImg] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!recap) return undefined;
    let url = null;
    drawRecap(recap).toBlob((b) => { url = URL.createObjectURL(b); setImg({ url, blob: b }); }, 'image/png');
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [recap]);

  const share = async () => {
    if (!img) return;
    const file = new File([img.blob], `oche-soiree-${recap.date.toISOString().slice(0, 10)}.png`, { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Récap de la soirée' }); return; }
    } catch (e) { if (e?.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = img.url; a.download = file.name; a.click();
    setMsg('Image téléchargée.');
  };

  return (
    <Sheet onClose={onClose} label="Récap de la soirée">
      <div className="between">
        <span className="h2">Récap de la soirée</span>
        <button style={{ color: 'var(--accent)', fontWeight: 700, minHeight: 44 }} onClick={onClose}>OK</button>
      </div>
      {!recap ? <div className="muted">Pas encore de partie terminée.</div> : (<>
        {img ? <img src={img.url} alt="Récap de la soirée" className="recap-img" /> : <div className="muted small">Préparation de l'image…</div>}
        <button className="btn btn-primary" onClick={share} disabled={!img}><Icon.Share />Partager sur le groupe</button>
        {msg && <div className="small muted" style={{ textAlign: 'center' }}>{msg}</div>}
      </>)}
    </Sheet>
  );
}
