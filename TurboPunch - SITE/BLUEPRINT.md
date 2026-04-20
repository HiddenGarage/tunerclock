# TurboPunch - Blueprint complet

## Objectif

Construire un site leger pour un garage FiveM avec:

- Connexion des employes avec Discord
- Punch in / punch out
- Panel admin reserve a `417605116070461442` et `893278269170933810`
- Dashboard detaille des heures
- Correction manuelle des heures
- Salaire horaire modifiable
- Leaderboard des employes les plus actifs
- Analyse des habitudes de travail: jour, soir, nuit
- Site leger, propre et facile a heberger gratuitement

## Structure conseillee

### Version ultra simple et legere

- `index.html`
- `style.css`
- `app.js`
- `logo/TurboPunch.png`

Cette version est parfaite pour:

- Maquette visuelle
- Demo rapide
- Hebergement gratuit

### Version reelle conseillee

- Front-end statique: GitHub Pages, Netlify ou Cloudflare Pages
- API: Node.js Express ou fonctions serverless
- Base de donnees: Supabase ou Firebase
- Bot Discord: Node.js avec `discord.js`

## Fonctionnement metier

### Cote employe

1. L’utilisateur clique sur `Connexion Discord`
2. Discord OAuth2 renvoie son ID Discord
3. Le site verifie si cet utilisateur est autorise a utiliser le panel
4. L’employe peut faire `Punch in`
5. L’heure de debut est enregistree
6. L’employe peut faire `Punch out`
7. L’heure de fin est enregistree et la duree est calculee

### Cote admin

Un admin est reconnu si son ID Discord est:

- `417605116070461442`
- `893278269170933810`

Fonctions admin:

- Voir tous les employes
- Voir les employes actifs en temps reel
- Voir les heures totales
- Modifier une entree d'heures
- Changer le salaire horaire
- Voir le classement des plus actifs
- Voir si l’employe travaille surtout le jour, le soir ou la nuit

## Regles de calcul

### Salaire

- Taux par defaut: `25$/h`
- Modifiable par l’admin
- Formule: `heures totales x taux horaire`

### Classification des quarts

- Jour: `06:00 -> 17:59`
- Soir: `18:00 -> 22:59`
- Nuit: `23:00 -> 05:59`

### Alerte 3 heures

Si un employe reste punch in plus de 3 heures:

1. Le bot Discord envoie un MP
2. Message exemple: `Tu es en service depuis plus de 3 heures. Confirme que tu es toujours actif.`
3. Si aucune reponse dans un delai defini, on peut:
   - notifier un admin
   - marquer l’employe comme a verifier

## Base de donnees proposee

### Table `employees`

- `id`
- `discord_id`
- `discord_name`
- `avatar`
- `role`
- `hourly_rate`
- `created_at`

### Table `shifts`

- `id`
- `employee_id`
- `punch_in_at`
- `punch_out_at`
- `duration_minutes`
- `shift_type`
- `status`
- `edited_by_admin`
- `notes`

### Table `admin_logs`

- `id`
- `admin_discord_id`
- `action_type`
- `target_employee_id`
- `before_value`
- `after_value`
- `created_at`

## API minimale

### Auth

- `GET /auth/discord/login`
- `GET /auth/discord/callback`
- `GET /api/me`

### Punch

- `POST /api/punch/in`
- `POST /api/punch/out`
- `GET /api/shifts/me`

### Admin

- `GET /api/admin/dashboard`
- `GET /api/admin/employees`
- `PATCH /api/admin/shifts/:id`
- `PATCH /api/admin/settings/hourly-rate`
- `GET /api/admin/leaderboard`

## Dashboard admin - widgets recommandes

- Nombre d’employes actifs
- Heures totales aujourd’hui
- Heures totales semaine
- Paie estimee totale
- Top 5 employes
- Repartition jour / soir / nuit
- Historique des modifications admin

## Hebergement gratuit conseille

### Option 1

- Front-end: GitHub Pages
- API: Render ou Railway si plan gratuit disponible
- Base: Supabase

### Option 2

- Front-end: Netlify
- Fonctions serverless: Netlify Functions
- Base: Supabase

### Option 3

- Front-end: Cloudflare Pages
- API: Cloudflare Workers
- Base: Supabase

## Priorite de developpement

### Phase 1

- Interface HTML simple
- Design propre
- Logo
- Demo du panel employe
- Demo du panel admin

### Phase 2

- Connexion Discord OAuth2
- Verification des IDs admin
- Enregistrement reel des punch

### Phase 3

- Base de donnees
- Historique complet
- Corrections admin
- Leaderboard dynamique

## Optimisation pour petit hebergement

- Pas de framework lourd au debut
- HTML/CSS/JS natif
- Peu d’images
- Une seule page si possible
- API separee et compacte
- Base de donnees externe gratuite

## Suite recommandee

Si tu veux la version complete et fonctionnelle, l’etape suivante ideale est:

1. Garder ce front-end
2. Ajouter une vraie connexion Discord
3. Ajouter Supabase pour stocker les heures
4. Ajouter les restrictions admin et l'edition d'heures
