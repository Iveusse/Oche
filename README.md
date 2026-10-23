# Oche

Compteur de fléchettes entre potes : X01, Cricket, Around the Clock, Shanghai, entraînements, stats partagées.
Appli web (React + Vite), données dans Supabase, hébergée sur Cloudflare.

## Mise en route (une seule fois)

### 1. Base Supabase
1. Ouvre `supabase/schema.sql` et remplace `CHANGE-MOI` (tout en bas) par votre code de groupe.
2. Dans Supabase > **SQL Editor** > New query, colle tout le fichier et clique **Run**.

Pour changer le code plus tard, relance seulement le dernier bloc `insert ... on conflict` avec le nouveau code.

### 2. Hébergement Cloudflare
1. Cloudflare > **Workers & Pages** > Create > Import a repository, choisis le repo `Oche`.
2. Build command : `npm run build` · Deploy command : `npx wrangler deploy` (valeurs par défaut).
   Le dossier de sortie (`dist`) est déclaré dans `wrangler.jsonc`, rien d'autre à régler.
3. Deploy. Chaque push sur `main` redéploie tout seul.

### 3. Sur l'iPhone
Ouvre l'URL `*.workers.dev` dans Safari > bouton Partager > **Sur l'écran d'accueil**.

## Dev

```
npm install
npm run dev          # serveur local
npm test             # tous les tests (≈ 80, moins de 2 secondes)
npm run test:watch   # relance les tests à chaque modification
npm run build
```

## Où est quoi

```
src/
  engine/       les règles et les calculs, sans rien d'affichage (testable seul)
    modes.js      règles de chaque jeu (X01, Cricket, Shanghai...) : init, dart, status, rankKey
    runner.js     runLeg : rejoue un leg à partir de la liste des fléchettes
    stats.js      stats de base (moyenne, victoires, séries) et records
    advanced.js   stats détaillées par jeu (celles de l'onglet Analyse)
    grades.js     lettres S à E des entraînements, seuils et critères
    level.js      niveau par jeu et niveau global (0 à 100)
    legreport.js  bilan « Ta partie » en fin de leg
    winprob.js    probabilité de victoire avant la partie, handicap équilibré
    plan.js       programme de la semaine, objectif de niveau, courbe
    checkout.js   entraînement aux checkouts, 5 niveaux progressifs
    coach.js      points faibles et exercices conseillés
    achievements.js  succès
  lib/          outils : cible (board.js), API Supabase, récap, vannes, voix, stockage local
  components/   petits composants d'affichage (cible, graphiques, badges)
  screens/      les écrans (Play = la partie, Tabs = accueil/stats/classement, Analysis = onglet Analyse...)
  types.js      la forme des données (partie, leg, fléchette, tour), en JSDoc
tests/          tous les tests, un fichier par thème (voir plus bas)
scripts/
  calibration/  scripts qui simulent des joueurs pour régler les seuils (génèrent rarity.js, coachref.js...)
  visual/       parcours Playwright qui prennent des captures et cherchent les erreurs d'affichage
supabase/       schéma de la base et migrations
```

### Comment ça marche, en deux phrases
Une partie, c'est la liste des fléchettes lancées. Tout le reste (reste à marquer, tours, classement, stats) est recalculé
par `runLeg`, donc annuler = retirer la dernière fléchette, et on peut ajouter n'importe quelle stat après coup sur l'historique.

### Où sont les tests
Dans le dossier **`tests/`**, un fichier par thème :

| Fichier | Ce qu'il vérifie |
|---|---|
| `regles-des-jeux.test.js` | cible, X01, Cricket, ATC, Shanghai, Baseball, Killer, Count Up, handicap |
| `entrainements.test.js` | exercices solo, ATC ciblé, checkouts progressifs |
| `stats-et-succes.test.js` | moyennes, succès, palmarès de la semaine, face à face |
| `coach-vannes-et-voix.test.js` | coach, vannes, félicitations, saisie à la voix |
| `niveau-bilan-et-programme.test.js` | notes S à E, niveau global, bilan du leg, probabilité de victoire, programme, formats de Shanghai |
| `helpers.js` | `D(20, 3)` = triple 20, `miss` = hors cible, `leg(...)` = un leg en cours |

### Lexique des noms courts
| Nom | Veut dire |
|---|---|
| `g`, `game` | une partie (voir `src/types.js`) |
| `leg` | une manche : joueurs dans l'ordre + liste des fléchettes |
| `r` | le résultat de `runLeg(mode, settings, leg)` |
| `ps` | « player states » : l'état de chaque joueur dans `r` (reste, points, cibles...) |
| `t`, `turn` | un tour : jusqu'à 3 fléchettes d'un joueur |
| `d`, `dart` | une fléchette : `{ seg, mult }`, `seg` 1 à 20 (25 = bull, 0 = hors cible), `mult` 1 simple, 2 double, 3 triple |
| `pid`, `ids` | identifiant(s) de joueur |
| `rem`, `remBefore` | reste à marquer (avant la fléchette) |
| `co`, `coAtt`, `coHit` | checkout : tentatives et réussites sur une fléchette de finish direct |
| `coVis` | passages à portée de finish (tours qui démarrent à un reste finissable) |
| `avg`, `avgAll`, `avgUntil[100]` | moyenne sur 3 fléchettes : totale, ou tant qu'il reste plus de 100 |
| `sigma` | dispersion d'un joueur simulé (plus petit = plus précis), voir `scripts/calibration` |
| `thr`, `cfg` | seuils (S, A, B, C, D) et configuration d'un indicateur noté |
| `rel` | écart relatif au niveau habituel dans le bilan de leg |
| `fmt` (Shanghai) | format « 1-7 », « 1-10 », « 1-20 » : les points ne se comparent qu'au même format |

### Ajouter un mode de jeu
1. Les règles dans `src/engine/modes.js` (`init`, `dart`, `status`, `rankKey`) et son nom dans `MODE_LABEL`.
2. Un test dans `tests/regles-des-jeux.test.js`.
3. L'entrée dans l'écran Nouvelle partie (`src/screens/NewGame.jsx`) et l'affichage en jeu (`src/screens/Play.jsx`).
4. Ses stats dans `src/engine/advanced.js`, son niveau dans `src/engine/level.js`, son bilan dans `src/engine/legreport.js`.

### Les scripts
`npm run calibrate` recalcule la rareté des succès. Les autres sont lancés à la main (`node scripts/calibration/xxx.mjs`).
Les parcours `scripts/visual/*-check.mjs` demandent un serveur lancé (`npm run build && npm run preview -- --port 4173`)
et Playwright ; ils simulent Supabase, donc ne touchent pas à vos vraies données.
