// Easter egg « mode vanne » : phrases pas cool quand ça se passe mal, et un clin d'oeil au Guide du voyageur galactique pour un 42.
import { load, save } from './store.js';

export const trashOn = () => load('trash', false);
export const setTrashOn = (v) => save('trash', v);

const pick = (a) => a[Math.floor(Math.random() * a.length)];

const H2G2 = [
  'La réponse à la grande question sur la vie, l\'univers et le reste : quarante-deux.',
  'Quarante-deux. La réponse à la grande question. Reste à retrouver la question.',
  'Quarante-deux. Ne paniquez pas, et n\'oubliez pas votre serviette.',
  'Quarante-deux. Deep Thought a mis sept millions et demi d\'années pour le calculer, toi, trois fléchettes.',
];
const MISS = [
  (n) => `${n}, le mur est content, tu l\'as épargné`,
  (n) => `${n}, même les yeux fermés tu ferais mieux`,
  (n) => `${n}, tu visais le voisin ?`,
  (n) => `Bravo ${n}, trois fois à côté, c\'est presque un talent`,
  (n) => `${n}, la cible est juste en face de toi`,
];
const BAD = [
  (n) => `${n}, c\'est tout ? Ma grand-mère fait mieux`,
  (n) => `Aïe ${n}, on dirait que tu lances avec le coude`,
  (n) => `${n}, on va dire que c\'est l\'échauffement`,
  (n) => `${n}, franchement, c\'est triste`,
];
const BUST = [
  (n) => `${n}, tu sais compter ? C\'est pas compliqué pourtant`,
  (n) => `Quel talent ${n}, un score de plus et tu sortais du tableau`,
  (n) => `${n}, tu as raté le finish, mais avec style`,
];
const LOSS = [
  (n) => `${n}, tu as perdu, mais l\'important c\'est de participer, paraît-il`,
  (n) => `${n}, défaite. Tu peux rejeter la faute sur les fléchettes`,
  (n) => `${n}, dernier. Ça se travaille, l\'humilité`,
  (n) => `Courage ${n}, il y aura d\'autres parties pour te faire battre`,
];

// t : le tour qui vient de finir ; renvoie une phrase ou null
export function roastTurn(mode, t, name, pts) {
  if (!trashOn() || t.darts.length < 3) return null;
  if (pts === 42 && (mode === 'x01' || mode === 'shanghai')) return pick(H2G2);
  if (t.bust) return pick(BUST)(name);
  const missed = t.darts.every((d) => !d.mult || d.hit === false);
  if (missed) return pick(MISS)(name);
  if ((mode === 'x01' || mode === 'train-checkout') && !t.finished && pts > 0 && pts <= 15) return pick(BAD)(name);
  return null;
}
export const roastLoss = (name) => (trashOn() && name ? pick(LOSS)(name) : null);
