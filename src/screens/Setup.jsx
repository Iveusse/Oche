import React, { useMemo, useState } from 'react';
import { checkCode } from '../lib/api.js';
import { Avatar, Icon, Sheet } from '../components/ui.jsx';
import { relTime } from '../lib/store.js';

export function CodeScreen({ onOk }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true); setErr('');
    try {
      if (await checkCode(code.trim())) onOk(code.trim());
      else setErr('Code incorrect.');
    } catch (e2) {
      setErr("Impossible de joindre le serveur. Vérifie ta connexion.");
    }
    setBusy(false);
  };
  return (
    <form className="screen" onSubmit={submit} style={{ paddingTop: 'calc(72px + var(--safe-top))' }}>
      <div className="h1" style={{ fontSize: 34 }}>Oche</div>
      <div className="h2" style={{ marginTop: 12 }}>Code du groupe</div>
      <div className="muted" style={{ lineHeight: 1.4 }}>À saisir une seule fois, il est ensuite retenu sur ce téléphone.</div>
      <label className="col">
        <span className="label">Code</span>
        <input className="input" autoFocus autoCapitalize="off" autoCorrect="off" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Code du groupe" />
      </label>
      {err && <div style={{ color: 'var(--bad)' }}>{err}</div>}
      <button className="btn btn-primary" disabled={busy || !code.trim()} type="submit">{busy ? 'Vérification…' : 'Entrer'}</button>
    </form>
  );
}

export function ProfileScreen({ players, meId, onPick, onCreate, onSkip }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="screen" style={{ paddingTop: 'calc(56px + var(--safe-top))' }}>
      <div className="h1" style={{ fontSize: 32 }}>Oche</div>
      <div>
        <div className="h2">Qui es-tu ?</div>
        <div className="muted" style={{ marginTop: 4, lineHeight: 1.4 }}>Pour afficher tes stats à l'accueil et t'ajouter d'office aux parties. C'est retenu sur ce téléphone, tu peux changer quand tu veux.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
        {players.map((p) => (
          <button key={p.id} onClick={() => onPick(p.id)} className="card col" style={{ alignItems: 'center', padding: '14px 4px', border: `2px solid ${p.id === meId ? 'var(--accent)' : 'transparent'}` }}>
            <Avatar player={p} size={52} />
            <span style={{ fontSize: 14, fontWeight: 700, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
          </button>
        ))}
      </div>
      <button className="btn btn-dashed" onClick={() => setAdding(true)}><Icon.Plus />Je ne suis pas dans la liste</button>
      <button className="btn" style={{ marginTop: 'auto', color: 'var(--muted)', fontWeight: 600, fontSize: 14 }} onClick={onSkip}>Passer, je regarde juste</button>
      {adding && <NewPlayerSheet onClose={() => setAdding(false)} onCreate={async (name) => { const p = await onCreate(name); if (p) onPick(p.id); }} />}
    </div>
  );
}

export function NewPlayerSheet({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await onCreate(name.trim()); onClose(); } catch (e2) { setErr(/duplicate|unique/i.test(e2.message) ? 'Ce nom existe déjà.' : "Impossible de créer le joueur."); }
    setBusy(false);
  };
  return (
    <Sheet onClose={onClose} label="Nouveau joueur">
      <form className="col" style={{ gap: 14 }} onSubmit={submit}>
        <div className="h2">Nouveau joueur</div>
        <input className="input" autoFocus maxLength={24} placeholder="Prénom ou surnom" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nom du joueur" />
        {err && <div style={{ color: 'var(--bad)' }}>{err}</div>}
        <button className="btn btn-primary" disabled={busy || !name.trim()} type="submit">Créer</button>
      </form>
    </Sheet>
  );
}

export function PlayerPicker({ players, games, selected, onDone, onClose, onCreate, lastPlayedMap, hidden = [], onToggleHidden, meId }) {
  const [showHidden, setShowHidden] = useState(false);
  const [sel, setSel] = useState(selected);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const isHid = (p) => hidden.includes(p.id) && p.id !== meId && !selected.includes(p.id);
  const matches = (p) => p.name.toLowerCase().includes(q.toLowerCase());
  const list = useMemo(() => players
    .filter((p) => matches(p) && !isHid(p))
    .sort((a, b) => (lastPlayedMap[b.id] || 0) - (lastPlayedMap[a.id] || 0) || a.name.localeCompare(b.name)), [players, q, lastPlayedMap, hidden]); // eslint-disable-line react-hooks/exhaustive-deps
  const hiddenList = players.filter((p) => matches(p) && isHid(p)).sort((a, b) => a.name.localeCompare(b.name));
  const toggle = (id) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  const added = sel.filter((x) => !selected.includes(x)).length;
  return (
    <Sheet onClose={onClose} label="Ajouter des joueurs">
      <div className="between">
        <span style={{ fontSize: 20, fontWeight: 800 }}>Joueurs de la partie</span>
        <button style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 15, minHeight: 44 }} onClick={() => onDone(sel)}>OK{added ? ` (+${added})` : ''}</button>
      </div>
      <label className="row input" style={{ height: 44 }}>
        <Icon.Search style={{ color: 'var(--muted)' }} />
        <input style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 15 }} placeholder="Chercher un joueur" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher un joueur" />
      </label>
      <div className="small muted">Triés par dernière partie jouée</div>
      <div className="col" style={{ gap: 6 }}>
        {list.map((p) => {
          const on = sel.includes(p.id);
          return (
            <div key={p.id} className="row" style={{ gap: 6 }}>
              <button className={`pick-row grow ${on ? 'on' : ''}`} onClick={() => toggle(p.id)} aria-pressed={on}>
                <span className="grow" style={{ fontSize: 15, fontWeight: on ? 700 : 600 }}>{p.name}</span>
                <span className="small muted">{lastPlayedMap[p.id] ? relTime(lastPlayedMap[p.id]) : 'jamais joué'}</span>
                <span className={`check ${on ? 'on' : ''}`}>{on && <Icon.Check style={{ color: 'var(--on-accent)' }} />}</span>
              </button>
              {onToggleHidden && p.id !== meId && !on && <button className="icon-btn" aria-label={`Masquer ${p.name}`} title="Masquer ce joueur" onClick={() => onToggleHidden(p.id)}><Icon.X /></button>}
            </div>
          );
        })}
        {onToggleHidden && players.some((p) => hidden.includes(p.id) && p.id !== meId) && (
          <button className="small muted" style={{ textAlign: 'left', minHeight: 36 }} onClick={() => setShowHidden(!showHidden)}>
            {showHidden ? '▾' : '▸'} Joueurs masqués ({players.filter((p) => hidden.includes(p.id) && p.id !== meId).length})
          </button>
        )}
        {showHidden && hiddenList.map((p) => (
          <div key={p.id} className="row" style={{ gap: 6 }}>
            <div className="pick-row grow" style={{ opacity: 0.8 }}>
              <span className="grow" style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</span>
              <span className="small muted">{lastPlayedMap[p.id] ? relTime(lastPlayedMap[p.id]) : 'jamais joué'}</span>
            </div>
            <button className="btn btn-sky" style={{ minHeight: 44 }} onClick={() => onToggleHidden(p.id)}>Réafficher</button>
          </div>
        ))}
      </div>
      <button className="btn btn-dashed" onClick={() => setAdding(true)}><Icon.Plus />Créer un nouveau joueur</button>
      {adding && <NewPlayerSheet onClose={() => setAdding(false)} onCreate={async (name) => { const p = await onCreate(name); if (p) setSel((s) => [...s, p.id]); }} />}
    </Sheet>
  );
}
