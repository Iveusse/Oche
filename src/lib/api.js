import { createClient } from '@supabase/supabase-js';
import { load, save } from './store.js';

// Clé publique (publishable) : faite pour être dans le navigateur.
// Les données sont protégées par le code de groupe, vérifié côté base.
export const SUPABASE_URL = 'https://yhafrtjvcziqqxadcxfk.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_cGtfZEyM8T3nkMyaTJ1vyA_88ugL7f5';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// ---------- équipes enregistrées sur ce téléphone ----------
// teams : [{ id, name, code, adminToken? }], team : id de l'équipe active
export const getTeams = () => load('teams', []);
export const saveTeams = (t) => save('teams', t);
export const getTeamId = () => load('team', null);
export const setTeamId = (id) => save('team', id);
export const activeTeam = () => getTeams().find((t) => t.id === getTeamId()) || null;
export const getCode = () => activeTeam()?.code || null;
export const legacyCode = () => load('code', null);
export const clearLegacyCode = () => save('code', null);

export function rememberTeam(team) {
  const list = getTeams().filter((t) => t.id !== team.id);
  const prev = getTeams().find((t) => t.id === team.id) || {};
  saveTeams([...list, { ...prev, ...team }]);
  setTeamId(team.id);
}
export function patchTeam(id, patch) {
  saveTeams(getTeams().map((t) => (t.id === id ? { ...t, ...patch } : t)));
}
export function dropTeam(id) {
  saveTeams(getTeams().filter((t) => t.id !== id));
  if (getTeamId() === id) setTeamId(getTeams()[0]?.id || null);
}

const fail = (error) => {
  const e = new Error(error.message);
  e.badCode = /bad_code/.test(error.message);
  e.missing = /Could not find the function|does not exist|PGRST202/i.test(error.message);
  return e;
};

async function rpc(fn, args = {}, code = getCode()) {
  const { data, error } = await sb.rpc(fn, { p_code: code, ...args });
  if (error) throw fail(error);
  return data;
}

// rejoindre : renvoie { id, name, has_admin } ou null si le code n'existe pas
export async function joinTeam(code) {
  const { data, error } = await sb.rpc('oche_join', { p_code: code });
  if (error) throw fail(error);
  return data;
}
export async function createTeam(name) {
  const { data, error } = await sb.rpc('oche_create_team', { p_name: name });
  if (error) throw fail(error);
  return data; // { id, name, code, admin_token }
}
export const claimAdmin = (code) => rpc('oche_claim_admin', {}, code);
export const renameTeam = (code, token, name) => rpc('oche_rename_team', { p_token: token, p_name: name }, code);
export const regenCode = (code, token) => rpc('oche_regen_code', { p_token: token }, code);

export async function checkCode(code) {
  const { data, error } = await sb.rpc('oche_check', { p_code: code });
  if (error) throw new Error(error.message);
  return data === true;
}

export const fetchPlayers = () => rpc('oche_players');
export const addPlayer = (name, color) => rpc('oche_add_player', { p_name: name, p_color: color });
export const fetchGames = () => rpc('oche_games');

// Sauvegarde avec file d'attente hors ligne
export async function saveGame(game) {
  const pending = load('pending', {});
  pending[game.id] = { ...game, updated: Date.now(), __code: getCode() };
  save('pending', pending);
  await flushPending();
}

export async function flushPending() {
  const pending = load('pending', {});
  for (const id of Object.keys(pending)) {
    const { __code, updated, ...game } = pending[id];
    const code = __code || getCode();
    try {
      await rpc('oche_save_game', { p_game: game }, code);
      const cur = load('pending', {});
      if (cur[id] === undefined || cur[id].updated === pending[id].updated) delete cur[id];
      save('pending', cur);
    } catch (e) {
      if (e.badCode && code === getCode()) throw e;
      // réseau KO (ou autre équipe) : on réessaiera plus tard
    }
  }
  return Object.keys(load('pending', {})).length;
}

// Remise à zéro d'un profil : le code est ressaisi pour confirmer
export async function resetPlayer(code, playerId) {
  const { data, error } = await sb.rpc('oche_reset_player', { p_code: code, p_player: playerId });
  if (error) {
    if (/bad_code/.test(error.message)) throw new Error('Code incorrect.');
    if (/oche_reset_player|function/i.test(error.message)) throw new Error("La base n'est pas à jour : lance le fichier supabase/003_equipes.sql dans Supabase.");
    throw new Error("Impossible de joindre le serveur.");
  }
  return data;
}
