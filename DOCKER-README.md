# Dashboard avec Docker et PostgreSQL

Ce projet est un dashboard de productivité personnel avec :
- ✅ Authentification sécurisée (NextAuth.js)
- ✅ Base de données PostgreSQL
- ✅ Gestion des tâches, missions, projets
- ✅ Calendrier et événements
- ✅ Routine matinale avec suivi de streak
- ✅ Statistiques et insights quotidiens
- ✅ Sidebar masquée par défaut
- ✅ Déploiement Docker simplifié

## 🚀 Démarrage rapide avec Docker

### Prérequis

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Installation et lancement

1. **Cloner le projet et naviguer dans le dossier**
   ```bash
   cd Dashbord
   ```

2. **Créer le fichier d'environnement**
   ```bash
   cp .env.example .env
   ```

3. **Générer une clé secrète pour NextAuth**
   ```bash
   # Sur Linux/Mac
   openssl rand -base64 32

   # Sur Windows PowerShell
   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
   ```
   
   Copiez la clé générée et remplacez la valeur de `NEXTAUTH_SECRET` dans le fichier `.env`

4. **Démarrer l'application avec Docker Compose**
   ```bash
   docker-compose up -d
   ```

   Cette commande va :
   - Démarrer PostgreSQL
   - Construire et démarrer l'application Next.js
   - Appliquer les migrations de base de données automatiquement

5. **Accéder à l'application**
   - Ouvrez votre navigateur à l'adresse : http://localhost:3000
   - Vous serez redirigé vers la page de connexion
   - Créez un compte en cliquant sur "Pas de compte ? S'inscrire"
   - Les données de démonstration seront automatiquement créées (routines, insights)

### Commandes utiles

- **Arrêter l'application**
  ```bash
  docker-compose down
  ```

- **Arrêter et supprimer les volumes (⚠️ supprime les données)**
  ```bash
  docker-compose down -v
  ```

- **Voir les logs**
  ```bash
  # Logs de l'application
  docker-compose logs -f app
  
  # Logs de la base de données
  docker-compose logs -f postgres
  ```

- **Reconstruire l'application après des modifications**
  ```bash
  docker-compose up -d --build
  ```

- **Accéder à la base de données PostgreSQL**
  ```bash
  docker-compose exec postgres psql -U user -d dashboard_db
  ```

- **Exécuter une commande dans le conteneur de l'application**
  ```bash
  docker-compose exec app sh
  ```

## 📦 Développement local (sans Docker)

### Prérequis

- Node.js 20+
- pnpm
- PostgreSQL 16

### Installation

1. **Installer les dépendances**
   ```bash
   pnpm install
   ```

2. **Configurer la base de données**
   - Créez une base de données PostgreSQL locale
   - Copiez `.env.example` vers `.env`
   - Ajustez `DATABASE_URL` avec vos identifiants PostgreSQL

3. **Générer Prisma Client et créer les tables**
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```

4. **Lancer le serveur de développement**
   ```bash
   pnpm dev
   ```

5. **Accéder à l'application**
   - Ouvrez http://localhost:3000
   - Créez un compte pour commencer

## 🔐 Fonctionnalités de sécurité

- **Authentification sécurisée** avec NextAuth.js
- **Mots de passe hashés** avec bcrypt (10 rounds)
- **Sessions JWT** pour une meilleure performance
- **Protection des routes** via middleware Next.js
- **Base de données PostgreSQL** pour la persistance sécurisée
- **Isolation des données** par utilisateur (toutes les requêtes filtrées par userId)
- **Relations CASCADE** pour la suppression propre des données

## 🗄️ Structure de la base de données

### Tables principales

- **users** - Comptes utilisateurs
- **user_settings** - Paramètres personnalisés (thème, horaires, etc.)
- **routine_actions** - Actions de la routine matinale
- **routine_logs** - Historique des routines complétées
- **tasks** - Tâches individuelles
- **missions** - Missions avec tâches associées
- **projects** - Projets avec objectifs et tâches
- **calendar_events** - Événements du calendrier
- **daily_insights** - Citations et conseils quotidiens

### Relations

- Chaque utilisateur a ses propres données isolées
- Les tâches peuvent être liées à des missions ou projets
- Les événements du calendrier peuvent référencer des missions/projets
- Suppression en cascade pour nettoyer automatiquement les données

## 📝 Structure du projet

```
├── app/                    # Pages Next.js App Router
│   ├── api/               # API Routes
│   │   ├── auth/         # Authentification (NextAuth)
│   │   ├── data/         # Récupération des données utilisateur
│   │   └── sync/         # Synchronisation des modifications
│   ├── login/            # Page de connexion/inscription
│   └── page.tsx          # Page principale (dashboard)
├── components/           # Composants React
│   ├── pages/           # Pages du dashboard
│   └── ui/              # Composants UI réutilisables
├── lib/                 # Utilitaires et configuration
│   ├── auth.ts         # Configuration NextAuth
│   ├── prisma.ts       # Client Prisma
│   ├── seed.ts         # Données de démonstration
│   ├── store.ts        # State management
│   └── types.ts        # Types TypeScript
├── prisma/             # Schema et migrations Prisma
│   ├── schema.prisma   # Définition du schéma de BDD
│   └── migrations/     # Migrations SQL
├── docker-compose.yml  # Configuration Docker Compose
├── Dockerfile          # Image Docker de l'application
└── .env.example        # Template des variables d'environnement
```

## 🎨 Fonctionnalités

### Interface
- ✅ Sidebar masquée par défaut (toggle pour afficher/masquer)
- ✅ Mode sombre/clair avec détection système
- ✅ Interface responsive et moderne

### Authentification
- ✅ Inscription avec email et mot de passe
- ✅ Connexion sécurisée
- ✅ Sessions persistantes
- ✅ Protection automatique des routes

### Gestion des données
- ✅ **Routines** - Créez et suivez vos habitudes quotidiennes
- ✅ **Tâches** - Gérez vos tâches avec priorités et dates d'échéance
- ✅ **Missions** - Organisez des missions avec objectifs et timeframe
- ✅ **Projets** - Suivez vos projets avec objectifs et deadlines
- ✅ **Calendrier** - Planifiez vos événements avec récurrence
- ✅ **Statistiques** - Visualisez vos progrès et statistiques
- ✅ **Insights** - Recevez des conseils et citations motivantes

### Base de données
- ✅ PostgreSQL avec Prisma ORM
- ✅ Migrations gérées automatiquement
- ✅ Données isolées par utilisateur
- ✅ Synchronisation en temps réel

### Déploiement
- ✅ Docker et Docker Compose
- ✅ Configuration simplifiée
- ✅ Base de données incluse
- ✅ Migrations automatiques au démarrage

## 🚀 Déploiement en production

### Variables d'environnement

Assurez-vous de définir ces variables en production :

```env
DATABASE_URL=postgresql://user:password@postgres:5432/dashboard_db
NEXTAUTH_URL=https://votre-domaine.com
NEXTAUTH_SECRET=votre-cle-secrete-tres-longue-et-aleatoire
```

### Avec Docker Compose

```bash
# Production
docker-compose -f docker-compose.yml up -d

# Avec https et reverse proxy (nginx, traefik, etc.)
# Ajustez NEXTAUTH_URL dans .env
```

## 🐛 Dépannage

### L'application ne démarre pas
- Vérifiez que Docker est en cours d'exécution
- Vérifiez les logs : `docker-compose logs -f`
- Assurez-vous que les ports 3000 et 5432 sont libres

### Erreur de connexion à la base de données
- Attendez quelques secondes que PostgreSQL démarre complètement
- Vérifiez `docker-compose logs postgres`
- Redémarrez les conteneurs : `docker-compose restart`

### Les migrations ne s'appliquent pas
```bash
# Appliquer manuellement les migrations
docker-compose exec app npx prisma migrate deploy

# Regénérer le client Prisma
docker-compose exec app npx prisma generate
```

### Réinitialiser complètement la base de données
```bash
# ⚠️ Cela supprime toutes les données !
docker-compose down -v
docker-compose up -d
```
