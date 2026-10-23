// Les formes de données de l'appli, en un seul endroit (JSDoc : sert de documentation, rien n'est exécuté).
// Tout l'état d'une partie est la liste des fléchettes lancées : le reste (scores, tours, classement) est recalculé
// par `runLeg` (src/engine/runner.js). Annuler = retirer la dernière fléchette.

/**
 * Une fléchette.
 * @typedef {object} Dart
 * @property {number} seg   numéro touché : 1 à 20, 25 pour le bull, 0 pour « hors cible »
 * @property {number} mult  1 simple, 2 double, 3 triple, 0 hors cible (le bull compte 1 pour le 25 et 2 pour le bull central)
 * @property {number} [x]   position sur la cible (pour la heatmap)
 * @property {number} [y]
 */

/**
 * Un leg = une manche d'une partie.
 * @typedef {object} Leg
 * @property {string[]} order          ids des joueurs, dans l'ordre de passage
 * @property {Dart[]} darts            toutes les fléchettes lancées, dans l'ordre
 * @property {number} validated        nombre de tours validés par le joueur (les suivants attendent « Valider »)
 * @property {boolean} [done]          leg terminé
 * @property {string[]} [ranking]      ids des joueurs, du premier au dernier (rempli à la fin)
 * @property {number[]} [targets]      cibles imposées (Around the Clock, entraînements)
 * @property {string} [finishedAt]     date ISO de fin
 * @property {number} [activeMs]       temps de jeu effectif
 */

/**
 * Une partie, telle que stockée dans Supabase (table games).
 * @typedef {object} Game
 * @property {string} id
 * @property {string} mode               'x01' | 'cricket' | 'atc' | 'shanghai' | 'baseball' | 'killer' | 'countup' | 'train-*'
 * @property {object} settings           réglages du mode (ex. x01 : { start: 501, in: 'single', out: 'double', starts: {id: 301} })
 * @property {string[]} player_ids
 * @property {'in_progress'|'finished'} status
 * @property {string} created_at
 * @property {{ legs: Leg[], legsToWin: number }} data
 */

/**
 * Un tour de jeu (jusqu'à 3 fléchettes d'un joueur) tel que le rend runLeg.
 * @typedef {object} Turn
 * @property {number} p          indice du joueur dans leg.order
 * @property {object[]} darts    les fléchettes, enrichies par le mode (pts, remBefore, hit, target...)
 * @property {number} round      numéro de la manche (0 pour le premier tour de chacun)
 * @property {number} nth        combien de tours ce joueur avait déjà joués
 * @property {boolean} [bust]    dépassé : le tour ne compte pas
 * @property {boolean} [finished] le joueur a fini pendant ce tour
 */

/**
 * Ce que renvoie runLeg.
 * @typedef {object} RunResult
 * @property {object[]} ps          état de chaque joueur (« player states ») : { id, finished, ...champs propres au mode }
 * @property {Turn[]} turns         tours terminés
 * @property {Turn|null} current    tour en cours
 * @property {number} cur           indice du joueur qui doit lancer
 * @property {number[]} finishedOrder
 * @property {string[]} ranking
 * @property {boolean} over         leg terminé
 * @property {boolean} needDecision on attend « continuer pour les places ? »
 * @property {boolean} awaiting     des tours attendent la validation
 * @property {boolean} instantWin   victoire immédiate (Shanghai)
 */

export {};
