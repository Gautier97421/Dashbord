# 🎯 Dashboard DashLife - Guide Complet

## 📋 Résumé des modifications

Votre dashboard a été mis à jour avec les fonctionnalités suivantes :

### ✅ 1. Sidebar cachée par défaut
- La sidebar est maintenant masquée au démarrage
- Cliquez sur le bouton ☰ (toggle) pour l'afficher/masquer
- **Fichier modifié** : [app/page.tsx](app/page.tsx#L54)

### ✅ 2. Système d'authentification complet
- Inscription et connexion sécurisées
- Mots de passe hashés avec bcrypt (10 rounds)
- Sessions JWT avec NextAuth.js
- Protection automatique des routes via middleware
- **Fichiers créés** :
  - [lib/auth.ts](lib/auth.ts) - Configuration NextAuth
  - [app/login/page.tsx](app/login/page.tsx) - Page de connexion/inscription
  - [middleware.ts](middleware.ts) - Protection des routes
  - [app/api/auth/[...nextauth]/route.ts](app/api/auth/[...nextauth]/route.ts)
  - [app/api/auth/register/route.ts](app/api/auth/register/route.ts)

### ✅ 3. Base de données PostgreSQL complète
- **8 tables** pour toutes vos données :
  - `users` - Comptes utilisateurs
  - `user_settings` - Paramètres (thème, horaires)
  - `routine_actions` - Actions de routine matinale
  - `routine_logs` - Historique des routines
  - `tasks` - Tâches individuelles
  - `missions` - Missions avec objectifs
  - `projects` - Projets avec deadlines
  - `calendar_events` - Événements du calendrier
  - `daily_insights` - Citations et conseils

- **Relations intelligentes** :
  - Tâches liées aux missions et projets
  - Événements liés aux missions et projets
  - Suppression en cascade (cleanup automatique)
  - Isolation complète des données par utilisateur

- **Fichiers créés** :
  - [prisma/schema.prisma](prisma/schema.prisma) - Schéma de base de données
  - [lib/prisma.ts](lib/prisma.ts) - Client Prisma
  - [lib/seed.ts](lib/seed.ts) - Données de démonstration

### ✅ 4. API de synchronisation
- Récupération des données : `GET /api/data`
- Synchronisation en temps réel : `POST /api/sync`
- Toutes les modifications sont automatiquement sauvegardées en BDD
- **Fichiers créés** :
  - [app/api/data/route.ts](app/api/data/route.ts)
  - [app/api/sync/route.ts](app/api/sync/route.ts)

### ✅ 5. Docker et Docker Compose
- Configuration complète pour déploiement simplifié
- PostgreSQL inclus et pré-configuré
- Migrations automatiques au démarrage
- Build optimisé multi-stage
- **Fichiers créés** :
  - [Dockerfile](Dockerfile) - Image de l'application
  - [docker-compose.yml](docker-compose.yml) - Orchestration
  - [.dockerignore](.dockerignore) - Exclusions
  - [DOCKER-README.md](DOCKER-README.md) - Documentation complète

## 🚀 Démarrage rapide

### Option 1 : Docker (Recommandé pour production)

```bash
# 1. Générer une clé secrète
# Windows PowerShell :
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

# Linux/Mac :
openssl rand -base64 32

# 2. Mettre la clé dans .env (remplacer NEXTAUTH_SECRET)

# 3. Démarrer tout
docker-compose up -d

# 4. Ouvrir http://localhost:3000
```

### Option 2 : Développement local

```bash
# 1. Installer PostgreSQL localement

# 2. Créer une base de données
createdb dashboard_db

# 3. Configurer .env avec DATABASE_URL

# 4. Appliquer les migrations
npx prisma migrate deploy

# 5. Démarrer le serveur
pnpm dev

# 6. Ouvrir http://localhost:3000
```

## 📊 Architecture de la base de données

```
users
 ├── user_settings (1:1)
 ├── routine_actions (1:N)
 │    └── routine_logs (1:N)
 ├── tasks (1:N)
 ├── missions (1:N)
 │    ├── tasks (1:N)
 │    └── calendar_events (1:N)
 ├── projects (1:N)
 │    ├── tasks (1:N)
 │    └── calendar_events (1:N)
 ├── calendar_events (1:N)
 └── daily_insights (1:N)
```

## 🔐 Sécurité

- ✅ Authentification NextAuth.js
- ✅ Mots de passe hashés (bcrypt, 10 rounds)
- ✅ Sessions JWT sécurisées
- ✅ Middleware de protection des routes
- ✅ Isolation des données par utilisateur (userId)
- ✅ Relations CASCADE pour cleanup automatique
- ✅ Variables d'environnement pour secrets

## 📝 Utilisation

### Premier lancement

1. Accédez à http://localhost:3000
2. Vous serez redirigé vers `/login`
3. Cliquez sur "Pas de compte ? S'inscrire"
4. Créez votre compte
5. Des données de démonstration seront créées automatiquement :
   - 5 actions de routine (Meditation, Exercise, Reading, etc.)
   - 4 insights quotidiens

### Fonctionnalités disponibles

- **Dashboard** - Vue d'ensemble de vos tâches et statistiques
- **Calendrier** - Planifiez vos événements avec récurrence
- **Routine matinale** - Suivez vos habitudes quotidiennes
- **Missions** - Organisez vos objectifs avec timeframe
- **Projets** - Gérez vos projets long terme
- **Statistiques** - Visualisez vos progrès
- **Paramètres** - Personnalisez l'expérience (thème, horaires)

### Sidebar

- **Cachée par défaut** pour plus d'espace
- Cliquez sur ☰ (en haut à gauche) pour l'afficher
- Navigation rapide entre les pages

## 🛠️ Commandes utiles

### Développement

```bash
pnpm dev              # Serveur de développement
pnpm build            # Build de production
pnpm start            # Démarrer en production
pnpm lint             # Vérifier le code
```

### Prisma (Base de données)

```bash
npx prisma generate             # Générer le client Prisma
npx prisma migrate dev          # Créer une migration en dev
npx prisma migrate deploy       # Appliquer les migrations
npx prisma studio               # Interface visuelle de la BDD
npx prisma db push              # Push le schéma sans migration
```

### Docker

```bash
docker-compose up -d            # Démarrer en arrière-plan
docker-compose down             # Arrêter
docker-compose down -v          # Arrêter et supprimer les volumes
docker-compose logs -f app      # Voir les logs de l'app
docker-compose logs -f postgres # Voir les logs de la BDD
docker-compose restart          # Redémarrer
docker-compose exec app sh      # Shell dans le conteneur
```

## 🐛 Dépannage

### "EPERM: operation not permitted" lors du build Windows

C'est normal sur Windows avec `output: 'standalone'`. Cela fonctionne parfaitement dans Docker (Linux).

**Solution** : Utilisez Docker pour le build de production, ou désactivez temporairement `output: 'standalone'` dans [next.config.mjs](next.config.mjs).

### "Error: No database connection"

```bash
# Vérifier que PostgreSQL est démarré
docker-compose ps

# Vérifier la DATABASE_URL dans .env
cat .env

# Redémarrer PostgreSQL
docker-compose restart postgres
```

### "Prisma Client not generated"

```bash
npx prisma generate
```

### Réinitialiser complètement la BDD

```bash
# ⚠️ Supprime toutes les données !
docker-compose down -v
docker-compose up -d
```

### Port 3000 ou 5432 déjà utilisé

```bash
# Trouver le processus
netstat -ano | findstr :3000

# Ou modifier le port dans docker-compose.yml
ports:
  - "3001:3000"  # Utiliser 3001 au lieu de 3000
```

## 📚 Documentation

- [Next.js](https://nextjs.org/docs)
- [NextAuth.js](https://next-auth.js.org/)
- [Prisma](https://www.prisma.io/docs)
- [PostgreSQL](https://www.postgresql.org/docs/)
- [Docker](https://docs.docker.com/)
- [Radix UI](https://www.radix-ui.com/)

## 🎨 Technologies utilisées

- **Frontend** : Next.js 16, React 19, TypeScript
- **UI** : Radix UI, Tailwind CSS, Shadcn/ui
- **Backend** : Next.js API Routes
- **Auth** : NextAuth.js v4
- **Database** : PostgreSQL 16
- **ORM** : Prisma 6
- **Deployment** : Docker + Docker Compose
- **Charts** : Recharts
- **Icons** : Lucide React

## 📄 Variables d'environnement

Créez un fichier `.env` à la racine :

```env
# Base de données PostgreSQL
DATABASE_URL="postgresql://user:password@localhost:5432/dashboard_db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="votre-cle-secrete-generee"
```

## 🚢 Déploiement

### Avec Docker (recommandé)

```bash
# 1. Configurer .env avec DATABASE_URL et NEXTAUTH_SECRET

# 2. Démarrer
docker-compose up -d

# C'est tout ! ✨
```

### Sur Vercel/Railway/Render

1. Créer une base PostgreSQL
2. Configurer les variables d'environnement
3. Déployer le repo
4. Appliquer les migrations : `npx prisma migrate deploy`

## ✨ Prochaines étapes possibles

- [ ] Ajouter des notifications push
- [ ] Exporter les données en PDF
- [ ] Partage de projets entre utilisateurs
- [ ] Application mobile avec React Native
- [ ] Intégration Google Calendar
- [ ] Gamification avec niveaux et badges
- [ ] Mode hors ligne avec sync

## 📞 Support

Pour toute question ou problème :
1. Consultez [DOCKER-README.md](DOCKER-README.md) pour Docker
2. Vérifiez les logs : `docker-compose logs -f`
3. Vérifiez la console du navigateur (F12)

---

**Bon développement ! 🚀**
