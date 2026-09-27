import { createClient } from '@supabase/supabase-js';
import { load, save } from './store.js';

// Clé publique (publishable) : faite pour être dans le navigateur.
// Les données sont protégées par le code de groupe, vérifié côté base.
export const SUPABASE_URL = 'https://yhafrtjvcziqqxadcxfk.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_cGtfZEyM8T3nkMyaTJ1vyA_88ugL7f5';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

export const getCode = () => load('code', null);
export const setCode = (c) => save('code', c);

async function rpc(fn, args = {}) {
  const { data, error } = await sb.rpc(fn, { p_code: getCode(), ...args });
  if (error) {
    const e = new Error(error.message);
    e.badCode = /bad_code/.test(error.message);
    throw e;
  }
  return data;
}

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
  pending[game.id] = { ...game, updated: Date.now() };
  save('pending', pending);
  await flushPending();
}

export async function flushPending() {
  const pending = load('pending', {});
  for (const id of Object.keys(pending)) {
    try {
      await rpc('oche_save_game', { p_game: pending[id] });
      const cur = load('pending', {});
      if (cur[id] === undefined || cur[id].updated === pending[id].updated) delete cur[id];
      save('pending', cur);
    } catch (e) {
      if (e.badCode) throw e;
      // réseau KO : on réessaiera plus tard
    }
  }
  return Object.keys(load('pending', {})).length;
}
