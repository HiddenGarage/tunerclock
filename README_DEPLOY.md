# TunerClock - Deploiement complet

## 1. Ce que tu as maintenant

Le projet contient:

- site front-end `index.html`, `style.css`, `app.js`
- configuration Netlify
- fonctions serverless pour Discord OAuth
- base d'API pour le pointage et le paiement
- schema Supabase

## 2. Ce qu'il te faut creer

### Discord Developer Portal

Crée une application Discord puis un OAuth2:

- Redirect URI: `https://TON-SITE.netlify.app/auth/discord/callback`
- Scope minimum: `identify`

Tu recuperes:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_GUILD_ID`

### Supabase

1. Cree un projet sur [Supabase](https://supabase.com/docs/guides/getting-started)
2. Ouvre `SQL Editor`
3. Colle le fichier [supabase/schema.sql](/C:/Users/Cedrick/Desktop/TurboPunch%20-%20SITE/supabase/schema.sql)
4. Execute le script
5. Recupere:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

## 3. Deploiement Netlify

Source officielle: [Netlify create deploys](https://docs.netlify.com/site-deploys/create-deploys/)

### Methode recommandee

1. Cree un repo GitHub avec ce dossier
2. Connecte le repo a Netlify
3. Dans Netlify:
   - Build command: vide
   - Publish directory: `.`
4. Ajoute les variables d'environnement de [.env.example](/C:/Users/Cedrick/Desktop/TurboPunch%20-%20SITE/.env.example)
5. Redeploie le site

### Methode rapide

1. Va sur `app.netlify.com/drop`
2. Depose le dossier du projet
3. Ajoute ensuite les variables dans `Site configuration > Environment variables`
4. Redeploie

## 4. Variables a renseigner

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`
- `DISCORD_GUILD_ID`
- `SESSION_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ADMIN_IDS`

## 5. Routes preparees

### Auth

- `/auth/discord/login`
- `/auth/discord/callback`
- `/auth/me`
- `/auth/logout`

### API

- `/api/punch-in`
- `/api/punch-out`
- `/api/admin-pay-employee`
- `/api/admin-dashboard`

## 6. Important

Le front actuel reste une interface premium statique. Les fonctions serverless et la base sont deja preparees, mais tu dois encore:

1. remplir les variables d'environnement
2. creer le projet Discord
3. lancer le schema SQL Supabase
4. brancher ensuite le front a ces endpoints si tu veux quitter le mode demo

## 7. Option locale

Si tu veux tester localement:

1. installe Node.js
2. dans ce dossier lance `npm install`
3. installe Netlify CLI
4. lance `netlify dev`

## 8. Ce que je te conseille ensuite

Quand tu es pret, l'etape suivante ideale est:

1. brancher les boutons du front aux fonctions reelles
2. charger la vraie session Discord dans le dashboard
3. masquer automatiquement `Gestion`, `Finance`, `Pieces` et `Plan` pour les non-admins
