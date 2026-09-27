# Oche

Compteur de fléchettes entre potes : X01, Cricket, Around the Clock, Shanghai, entraînements, stats partagées.
Appli web (React + Vite), données dans Supabase, hébergée sur Cloudflare Pages.

## Mise en route (une seule fois)

### 1. Base Supabase
1. Ouvre `supabase/schema.sql` et remplace `CHANGE-MOI` (tout en bas) par votre code de groupe.
2. Dans Supabase > **SQL Editor** > New query, colle tout le fichier et clique **Run**.

Pour changer le code plus tard, relance seulement le dernier bloc `insert ... on conflict` avec le nouveau code.

### 2. Hébergement Cloudflare Pages
1. Cloudflare > **Workers & Pages** > Create > Pages > **Connect to Git**, choisis le repo `Oche`.
2. Réglages de build :
   - Framework preset : `Vite` (ou None)
   - Build command : `npm run build`
   - Build output directory : `dist`
3. Save and Deploy. Chaque push sur `main` redéploie tout seul.

### 3. Sur l'iPhone
Ouvre l'URL `*.pages.dev` dans Safari > bouton Partager > **Sur l'écran d'accueil**.

## Dev
```
npm install
npm run dev      # serveur local
npm test         # tests des règles de jeu
npm run build
```

## Sécurité
- La clé Supabase dans `src/lib/api.js` est la clé publique (publishable), faite pour être dans le navigateur.
- Les tables sont fermées (RLS sans policy). Tout passe par des fonctions `oche_*` qui vérifient le code de groupe.
- Une partie terminée ne peut plus être modifiée, et il n'existe aucune fonction de suppression.

## Supabase gratuit
Un projet gratuit se met en pause après ~7 jours sans activité. Rien n'est perdu : dashboard > **Resume project**.
