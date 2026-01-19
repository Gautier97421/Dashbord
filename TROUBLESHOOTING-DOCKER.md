# SOLUTION TEMPORAIRE - Problème Docker I/O

Docker Desktop rencontre une erreur d'I/O. Voici comment résoudre :

## Solution 1 : Redémarrer Docker Desktop (Recommandé)

1. **Fermer Docker Desktop complètement**
   ```powershell
   # Arrêter tous les conteneurs
   docker stop $(docker ps -aq)
   
   # Quitter Docker Desktop
   Stop-Process -Name "Docker Desktop" -Force
   ```

2. **Redémarrer votre ordinateur** (recommandé pour réinitialiser le système de fichiers)

3. **Relancer Docker Desktop**

4. **Nettoyer Docker** (optionnel mais recommandé)
   ```powershell
   docker system prune -a --volumes
   ```

5. **Relancer le projet**
   ```bash
   cd C:\Users\gauti\Documents\Dashbord
   docker-compose -f docker-compose.dev.yml up -d
   npx prisma migrate deploy
   pnpm dev
   ```

## Solution 2 : Installer PostgreSQL localement (Alternative)

Si Docker continue à avoir des problèmes :

1. **Télécharger PostgreSQL 16** : https://www.postgresql.org/download/windows/

2. **Installer et démarrer PostgreSQL**

3. **Créer la base de données**
   ```sql
   CREATE DATABASE dashboard_db;
   ```

4. **Mettre à jour .env**
   ```env
   DATABASE_URL="postgresql://postgres:votre_password@localhost:5432/dashboard_db"
   ```

5. **Appliquer les migrations**
   ```bash
   npx prisma migrate deploy
   ```

6. **Démarrer l'application**
   ```bash
   pnpm dev
   ```

## Solution 3 : Utiliser un service PostgreSQL cloud (Gratuit)

Services gratuits disponibles :
- **Supabase** : https://supabase.com (500 MB gratuit)
- **Neon** : https://neon.tech (3 GB gratuit)
- **Railway** : https://railway.app (5$ de crédit gratuit)

1. Créer un compte et une base de données
2. Copier la DATABASE_URL fournie
3. Mettre à jour le .env
4. `npx prisma migrate deploy`
5. `pnpm dev`

## Diagnostic de l'erreur actuelle

L'erreur `input/output error` indique :
- Corruption du système de fichiers Docker
- Manque d'espace disque
- Problème de permissions
- Cache Docker corrompu

**Actions recommandées :**
1. Vérifier l'espace disque disponible
2. Redémarrer l'ordinateur
3. Nettoyer Docker : `docker system prune -a --volumes`
