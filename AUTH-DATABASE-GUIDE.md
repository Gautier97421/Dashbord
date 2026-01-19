# Guide d'authentification et visualisation de la BDD

## 🔐 Système de Login/Inscription

### Fonctionnalités ajoutées :

1. **Page d'inscription** : `/register`
   - Création de compte avec nom, email et mot de passe
   - Validation des données (email valide, mot de passe min 6 caractères)
   - Vérification que l'email n'existe pas déjà

2. **Page de connexion** : `/login`
   - Authentification avec email et mot de passe
   - Gestion des erreurs
   - Redirection automatique après connexion

3. **Protection des routes**
   - Middleware NextAuth pour protéger toutes les pages sauf login/register
   - Redirection automatique vers `/login` si non connecté

### Comment utiliser :

1. Aller sur `http://localhost:3000`
2. Vous serez redirigé vers `/login`
3. Cliquer sur "S'inscrire" pour créer un compte
4. Remplir le formulaire d'inscription
5. Se connecter avec vos identifiants

## 🗄️ Visualisation de la base de données

### Option 1 : Prisma Studio (Recommandé) ✅

Prisma Studio est maintenant intégré dans Docker Compose !

**Accès :** `http://localhost:5555`

**Avantages :**
- Interface web moderne et intuitive
- Visualisation et édition des données
- Gestion des relations entre tables
- Aucune configuration supplémentaire

**Utilisation :**
1. Ouvrir `http://localhost:5555` dans votre navigateur
2. Sélectionner une table (User, Task, Mission, etc.)
3. Voir, créer, modifier ou supprimer des données
4. Explorer les relations entre tables

### Option 2 : pgAdmin (Interface complète)

Si vous préférez pgAdmin, ajoutez ce service dans `docker-compose.yml` :

```yaml
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: dashboard_pgadmin
    restart: unless-stopped
    ports:
      - "5050:80"
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@admin.com
      PGADMIN_DEFAULT_PASSWORD: admin
    depends_on:
      - postgres
```

Puis relancer : `docker compose up -d`

**Accès :** `http://localhost:5050`
- Email : admin@admin.com
- Password : admin

**Configuration de la connexion :**
- Host : postgres
- Port : 5432
- Database : dashboard_db
- Username : dashboard_user
- Password : dashboard_secret_2026

### Option 3 : Client en ligne de commande

```bash
# Se connecter à la base de données PostgreSQL
docker exec -it dashboard_postgres psql -U dashboard_user -d dashboard_db

# Commandes utiles :
\dt              # Lister les tables
\d users         # Décrire la table users
SELECT * FROM users;  # Voir tous les utilisateurs
\q               # Quitter
```

## 🚀 Commandes Docker utiles

```bash
# Voir les logs de l'application
docker compose logs -f app

# Voir les logs de Prisma Studio
docker compose logs -f prisma-studio

# Redémarrer un service
docker compose restart app

# Voir tous les conteneurs
docker ps

# Arrêter tous les services
docker compose down

# Arrêter et supprimer les volumes (⚠️ supprime les données)
docker compose down -v
```

## 📊 Structure des services

| Service | Port | Description |
|---------|------|-------------|
| app | 3000 | Application Next.js |
| postgres | 5432 | Base de données PostgreSQL |
| prisma-studio | 5555 | Interface de visualisation BDD |

## 🔧 Configuration

Variables d'environnement (voir `.env.example`) :
- `DATABASE_URL` : Connexion à la base de données
- `NEXTAUTH_URL` : URL de l'application
- `NEXTAUTH_SECRET` : Clé secrète pour NextAuth (à changer en production !)

## 📝 Notes importantes

1. Le middleware protège automatiquement toutes les routes sauf `/login`, `/register` et les assets
2. Les mots de passe sont hashés avec bcrypt (10 rounds)
3. Les sessions sont gérées avec JWT
4. Prisma Studio se connecte directement à la base de données PostgreSQL
