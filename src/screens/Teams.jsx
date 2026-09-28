import React, { useEffect, useState } from 'react';
import { Icon, Sheet } from '../components/ui.jsx';
import { claimAdmin, createTeam, getTeams, joinTeam, patchTeam, regenCode, renameTeam } from '../lib/api.js';

const APP_URL = typeof window !== 'undefined' ? window.location.origin : '';
const shareText = (t) => `Rejoins l'équipe « ${t.name} » sur Oche, notre compteur de fléchettes : ${APP_URL}\nCode d'équipe : ${t.code}`;

async function shareCode(t, setMsg) {
  try {
    if (navigator.share) { await navigator.share({ title: 'Oche', text: shareText(t) }); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(shareText(t)); setMsg?.('Message copié, colle-le sur le groupe.'); } catch { setMsg?.(`Code : ${t.code}`); }
}

const netErr = (e) => (e?.missing ? 'Le serveur n\'est pas encore à jour (script SQL 003 à lancer).' : 'Impossible de joindre le serveur. Vérifie ta connexion.');

// ---------- premier écran : créer ou rejoindre ----------
export function Welcome({ onTeam, onCancel, notice }) {
  const [step, setStep] = useState('choose');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [found, setFound] = useState(null);
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const create = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const t = await createTeam(name.trim()); setCreated({ id: t.id, name: t.name, code: t.code, adminToken: t.admin_token }); setStep('created'); }
    catch (e2) { setErr(netErr(e2)); }
    setBusy(false);
  };
  const lookup = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const t = await joinTeam(code.trim());
      if (!t) setErr('Code inconnu. Vérifie-le avec la personne qui te l\'a envoyé.');
      else setFound({ id: t.id, name: t.name, code: code.trim(), hasAdmin: t.has_admin });
    } catch (e2) { setErr(netErr(e2)); }
    setBusy(false);
  };
  const already = (id) => getTeams().some((t) => t.id === id);

  return (
    <div className="screen" style={{ paddingTop: 'calc(56px + var(--safe-top))' }}>
      <div className="between">
        <div className="h1" style={{ fontSize: 34 }}>Oche</div>
        {onCancel && <button className="icon-btn" aria-label="Fermer" onClick={onCancel}><Icon.X /></button>}
      </div>
      {notice && <div className="panel small" style={{ border: '1px solid var(--bad)', color: 'var(--text-2)' }}>{notice}</div>}

      {step === 'choose' && (<>
        <div>
          <div className="h2">{onCancel ? 'Ajouter une équipe' : 'Bienvenue !'}</div>
          <div className="muted" style={{ marginTop: 4, lineHeight: 1.45 }}>Une équipe, c'est un groupe qui partage ses joueurs, ses parties et ses stats. Chaque équipe ne voit que les siennes.</div>
        </div>
        <button className="choice-big" onClick={() => { setStep('join'); setErr(''); }}>
          <Icon.Users /><div><div className="t">Rejoindre une équipe</div><div className="d">On t'a envoyé un code du genre K7P-4QX</div></div>
        </button>
        <button className="choice-big" onClick={() => { setStep('create'); setErr(''); }}>
          <Icon.Plus /><div><div className="t">Créer une équipe</div><div className="d">Tu obtiens un code à partager avec les autres</div></div>
        </button>
      </>)}

      {step === 'create' && (
        <form className="col" style={{ gap: 14 }} onSubmit={create}>
          <div className="h2">Créer une équipe</div>
          <label className="col">
            <span className="label">Nom de l'équipe</span>
            <input className="input" autoFocus maxLength={40} placeholder="ex : Les potes du jeudi" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nom de l'équipe" />
          </label>
          {err && <div style={{ color: 'var(--bad)' }}>{err}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy || !name.trim()}>{busy ? 'Création…' : 'Créer l\'équipe'}</button>
          <button type="button" className="btn btn-ghost" onClick={() => setStep('choose')}>Retour</button>
        </form>
      )}

      {step === 'created' && created && (
        <div className="col" style={{ gap: 14 }}>
          <div className="h2">« {created.name} » est prête</div>
          <div className="muted" style={{ lineHeight: 1.45 }}>Voici le code de l'équipe. Envoie-le aux autres : ils choisissent « Rejoindre une équipe » et le saisissent. Tu le retrouveras dans le menu des équipes.</div>
          <div className="team-code" aria-label={`Code ${created.code}`}>{created.code}</div>
          <button className="btn btn-sky" onClick={() => shareCode(created, setMsg)}><Icon.Share />Partager le code</button>
          {msg && <div className="small muted" style={{ textAlign: 'center' }}>{msg}</div>}
          <button className="btn btn-primary" onClick={() => onTeam(created)}>Continuer</button>
        </div>
      )}

      {step === 'join' && !found && (
        <form className="col" style={{ gap: 14 }} onSubmit={lookup}>
          <div className="h2">Rejoindre une équipe</div>
          <label className="col">
            <span className="label">Code de l'équipe</span>
            <input className="input team-input" autoFocus autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="K7P-4QX" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Code de l'équipe" />
          </label>
          {err && <div style={{ color: 'var(--bad)' }}>{err}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy || !code.trim()}>{busy ? 'Vérification…' : 'Continuer'}</button>
          <button type="button" className="btn btn-ghost" onClick={() => setStep('choose')}>Retour</button>
        </form>
      )}

      {step === 'join' && found && (
        <div className="col" style={{ gap: 14 }}>
          <div className="h2">Équipe trouvée</div>
          <div className="card" style={{ padding: 18, fontSize: 20, fontWeight: 800, textAlign: 'center' }}>{found.name}</div>
          {already(found.id) && <div className="small muted">Tu fais déjà partie de cette équipe sur ce téléphone.</div>}
          <button className="btn btn-primary" onClick={() => onTeam(found)}>{already(found.id) ? 'Y aller' : 'Rejoindre'}</button>
          <button className="btn btn-ghost" onClick={() => { setFound(null); setCode(''); }}>Ce n'est pas la bonne</button>
        </div>
      )}
    </div>
  );
}

// ---------- menu des équipes ----------
export function TeamSheet({ team, teams, onSwitch, onAdd, onLeave, onClose, onChanged }) {
  const [info, setInfo] = useState(null); // { has_admin } à jour depuis le serveur
  const [showCode, setShowCode] = useState(false);
  const [rename, setRename] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const admin = !!team.adminToken;

  useEffect(() => {
    joinTeam(team.code).then((t) => { if (t) { setInfo(t); if (t.name !== team.name) { patchTeam(team.id, { name: t.name }); onChanged(); } } }).catch(() => {});
  }, [team.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn) => { setBusy(true); setMsg(''); try { await fn(); } catch (e) { setMsg(e.missing ? netErr(e) : e.message.includes('not_admin') ? 'Ce téléphone n\'est plus admin de l\'équipe.' : 'Impossible de joindre le serveur.'); } setBusy(false); };

  return (
    <Sheet onClose={onClose} label="Équipes">
      <div className="between">
        <span className="h2">Équipes</span>
        <button style={{ color: 'var(--accent)', fontWeight: 700, minHeight: 44 }} onClick={onClose}>OK</button>
      </div>

      <div className="col" style={{ gap: 6 }}>
        {teams.map((t) => (
          <button key={t.id} className={`list-item ${t.id === team.id ? 'on' : ''}`} onClick={() => (t.id === team.id ? null : onSwitch(t.id))} aria-current={t.id === team.id}>
            <div className="grow" style={{ fontWeight: 700 }}>{t.name}</div>
            {t.adminToken && <span className="coach-badge">Admin</span>}
            {t.id === team.id ? <Icon.Check style={{ color: 'var(--accent)' }} /> : <Icon.Right />}
          </button>
        ))}
        <button className="btn btn-dashed" onClick={onAdd}><Icon.Plus />Rejoindre ou créer une équipe</button>
      </div>

      <div className="panel col" style={{ gap: 10, background: 'var(--card)' }}>
        <span className="label">{team.name}</span>
        <div className="between">
          <span className="small muted">Code de l'équipe</span>
          <button className="team-code small-code" onClick={() => setShowCode(!showCode)} aria-label="Afficher le code">{showCode ? team.code : '•••-•••'}</button>
        </div>
        <button className="btn btn-sky" onClick={() => shareCode(team, setMsg)}><Icon.Share />Inviter quelqu'un</button>

        {admin && rename == null && (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost grow" disabled={busy} onClick={() => setRename(team.name)}>Renommer</button>
            <button className="btn btn-ghost grow" disabled={busy} onClick={() => act(async () => {
              if (!confirm('Changer le code ? L\'ancien ne marchera plus : chacun devra saisir le nouveau (tu pourras le partager tout de suite).')) return;
              const c = await regenCode(team.code, team.adminToken);
              patchTeam(team.id, { code: c }); onChanged(); setShowCode(true); setMsg(`Nouveau code : ${c}. Partage-le aux autres.`);
            })}>Changer le code</button>
          </div>
        )}
        {admin && rename != null && (
          <form className="row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); act(async () => { await renameTeam(team.code, team.adminToken, rename.trim()); patchTeam(team.id, { name: rename.trim() }); setRename(null); onChanged(); }); }}>
            <input className="input grow" autoFocus maxLength={40} value={rename} onChange={(e) => setRename(e.target.value)} aria-label="Nouveau nom" />
            <button className="btn btn-primary" type="submit" disabled={busy || !rename.trim()}>Enregistrer</button>
          </form>
        )}
        {!admin && info && !info.has_admin && (
          <button className="btn btn-ghost" disabled={busy} onClick={() => act(async () => {
            const tok = await claimAdmin(team.code);
            patchTeam(team.id, { adminToken: tok }); onChanged(); setMsg('Tu es admin de l\'équipe sur ce téléphone.');
          })}>Devenir admin de l'équipe</button>
        )}
        {admin && <div className="small muted" style={{ lineHeight: 1.4 }}>Tu es admin sur ce téléphone : toi seul peux renommer l'équipe et changer son code.</div>}
        {msg && <div className="small" style={{ color: 'var(--sky)', fontWeight: 600 }}>{msg}</div>}
      </div>

      <button className="small muted" style={{ alignSelf: 'center', minHeight: 36, textDecoration: 'underline' }}
        onClick={() => { if (confirm(`Retirer « ${team.name} » de ce téléphone ? Rien n'est supprimé : tu pourras la rejoindre à nouveau avec le code.${admin ? ' Attention : tu perdras ton rôle d\'admin.' : ''}`)) onLeave(team.id); }}>
        Quitter cette équipe sur ce téléphone
      </button>
    </Sheet>
  );
}
