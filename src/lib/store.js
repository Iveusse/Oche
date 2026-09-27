const P = 'oche.';

export function load(key, fallback) {
  try {
    const v = localStorage.getItem(P + key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    if (value === undefined || value === null) localStorage.removeItem(P + key);
    else localStorage.setItem(P + key, JSON.stringify(value));
  } catch {
    /* stockage indisponible (navigation privée) */
  }
}

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const PLAYER_COLORS = ['#5fc8ff', '#ff9f5a', '#b69cff', '#6ee7b7', '#ff7a9c', '#ffd166', '#7aa2ff', '#f472b6', '#a3e635', '#fb923c'];

export function relTime(ts) {
  if (!ts) return '';
  const d = (Date.now() - ts) / 86400000;
  if (d < 1) return "aujourd'hui";
  if (d < 2) return 'hier';
  if (d < 30) return `il y a ${Math.floor(d)} j`;
  if (d < 365) return `il y a ${Math.floor(d / 30)} mois`;
  return `il y a ${Math.floor(d / 365)} an${d >= 730 ? 's' : ''}`;
}

export function shortDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export const fmt1 = (v) => (v == null ? '-' : v.toFixed(1));
export const pct = (v) => (v == null ? '-' : `${Math.round(v * 100)} %`);
