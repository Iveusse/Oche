import { load, save } from './store.js';

export const THEMES = [
  ['neon', 'Néon'],
  ['club', 'Club'],
  ['ocean', 'Océan'],
  ['violet', 'Violet'],
  ['clair', 'Clair'],
];

export const BOARDS = [
  ['classique', 'Classique'],
  ['bois', 'Pub'],
  ['electro', 'Électronique'],
  ['daltonien', 'Daltonien'],
  ['mono', 'Mono'],
];

export function getLook() {
  return { theme: load('theme', 'neon'), board: load('board', 'classique') };
}

export function applyLook({ theme, board }) {
  const el = document.documentElement;
  el.dataset.theme = theme;
  el.dataset.board = board;
  const bg = getComputedStyle(el).getPropertyValue('--bg').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && bg) meta.setAttribute('content', bg);
}

export function setLook(look) {
  save('theme', look.theme);
  save('board', look.board);
  applyLook(look);
}
