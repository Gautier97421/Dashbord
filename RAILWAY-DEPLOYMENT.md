# Déploiement Railway

## 🚂 Configuration Railway

### 1. Créer un projet Railway

```bash
# Installer Railway CLI
npm install -g @railway/cli

# Login
railway login

# Créer un nouveau projet
railway init
```

### 2. Ajouter une base de données PostgreSQL

Dans le dashboard Railway :
1. **New Project** → **Deploy from GitHub repo**
2. Connectez votre repository
3. **Add service** → **Database** → **PostgreSQL**
4. Railway génère automatiquement `DATABASE_URL`

### 3. Variables d'environnement requises

Railway configure automatiquement `DATABASE_URL`, ajoutez manuellement :

```env
NEXTAUTH_URL=https://votre-app.up.railway.app
NEXTAUTH_SECRET=votre-cle-secrete-32-caracteres-minimum
NODE_ENV=production
```

### 4. Génération NEXTAUTH_SECRET

```bash
# Générer une clé secrète
openssl rand -base64 32
```

### 5. Configuration automatique

Railway utilise votre `Dockerfile` et `docker-compose.yml` existants.

### 6. Commandes de déploiement

```bash
# Déploiement automatique via Git
git push origin main

# Ou déploiement direct
railway up
```

### 7. Migration de la base de données

Railway exécute automatiquement les migrations Prisma au démarrage via le Dockerfile.

### 8. Variables d'environnement dans Railway

Dans votre projet Railway → **Variables** :
- `NEXTAUTH_URL` → `https://your-app.up.railway.app`
- `NEXTAUTH_SECRET` → `votre_cle_secrete_32_caracteres`
- `DATABASE_URL` → (automatique via PostgreSQL service)

### 9. Fichiers configurés

- ✅ `railway.json` - Configuration Railway
- ✅ `Dockerfile` - Déjà configuré
- ✅ `docker-compose.yml` - Déjà configuré

### ⚠️ Important

1. **Ne commitez jamais** de vraies clés dans le code
2. **Utilisez HTTPS** pour `NEXTAUTH_URL`
3. **La première migration** peut prendre quelques minutes
4. **Railway offre $5/mois** gratuit pour commencer

### 🚀 Étapes rapides

1. Push votre code sur GitHub
2. Créez un projet Railway
3. Connectez le repo GitHub
4. Ajoutez PostgreSQL service
5. Configurez les 2 variables d'environnement
6. Deploy automatique !

Votre app sera disponible sur `https://your-app.up.railway.app` 🎉