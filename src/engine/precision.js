// Indice de précision d'une fléchette visant un numéro (0 à 100).
// 100 = dans le numéro (simple, double ou triple). Sinon on mesure la distance à vol d'oiseau entre le numéro visé
// et la zone touchée, sur l'anneau du triple (rayon ~103 mm) : numéro voisin ≈ 45, à deux numéros ≈ 20,
// à l'opposé ≈ 0. Une fléchette hors cible vaut 0. Le Bull est loin de tous les numéros (≈ 8).
import { ORDER } from '../lib/board.js';

const RING_MM = 103; // rayon moyen de l'anneau du triple
const SCALE_MM = 40; // décroissance de l'indice avec la distance

export function dartPrecision(target, seg) {
  if (seg === target) return 100;
  if (!seg) return 0;
  let d;
  if (seg === 25) d = RING_MM;
  else {
    const a = ORDER.indexOf(target); const b = ORDER.indexOf(seg);
    if (a < 0 || b < 0) return 0;
    const k = Math.min(Math.abs(a - b), 20 - Math.abs(a - b)); // nombre de numéros d'écart autour de la cible
    d = 2 * RING_MM * Math.sin((k * Math.PI) / 20);
  }
  return Math.round(100 * Math.exp(-d / SCALE_MM));
}

// Une manche contient-elle de quoi juger le placement ? Oui si au moins une fléchette a été saisie ailleurs que sur le numéro
// visé (cible ou clavier). Avec les seuls boutons « touché / raté » on ne sait pas où sont les ratées : on ne note pas.
export const hasPlacement = (items) => items.some(({ seg, target }) => seg > 0 && seg !== target);

export const precisionLabel = (v) => (v == null ? '' : v >= 70 ? 'solide' : v >= 45 ? 'correct' : 'à travailler');
