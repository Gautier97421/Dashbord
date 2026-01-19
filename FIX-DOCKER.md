# Réparation de Docker Desktop - Erreur I/O

## ⚠️ Problème détecté
Docker Desktop a une corruption de sa base de données interne (`meta.db`).
Cela nécessite une réinitialisation complète.

## 🔧 Solution - Réinitialisation de Docker Desktop

### Étape 1 : Ouvrir Docker Desktop

1. Cliquez sur l'icône Docker dans la barre des tâches (en bas à droite)
2. Cliquez sur l'icône ⚙️ (Settings/Paramètres)

### Étape 2 : Reset complet

3. Allez dans l'onglet **"Troubleshoot"** (Dépannage) ou **"Reset"**
4. Cliquez sur **"Clean / Purge data"** ou **"Reset to factory defaults"**
   - ⚠️ Cela supprimera TOUS vos conteneurs, images et volumes Docker
   - C'est nécessaire pour réparer la corruption
5. Confirmez l'action
6. Attendez que Docker redémarre (2-3 minutes)

### Étape 3 : Relancer votre projet

Une fois Docker redémarré :

```powershell
# 1. Aller dans votre projet
cd C:\Users\gauti\Documents\Dashbord

# 2. Générer une clé secrète si pas déjà fait
$secret = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
Write-Host "Votre clé secrète : $secret"

# 3. Éditer .env et remplacer NEXTAUTH_SECRET avec la clé générée

# 4. Démarrer uniquement PostgreSQL pour le dev
docker-compose -f docker-compose.dev.yml up -d

# 5. Attendre que PostgreSQL soit prêt (10-15 secondes)
Start-Sleep -Seconds 15

# 6. Appliquer les migrations
npx prisma migrate deploy

# 7. Démarrer le serveur de développement
pnpm dev
```

## 🎯 Alternative rapide : Via ligne de commande

Si vous ne trouvez pas l'option dans l'interface :

```powershell
# 1. Quitter Docker Desktop complètement
Stop-Process -Name "Docker Desktop" -Force -ErrorAction SilentlyContinue

# 2. Supprimer les données Docker (⚠️ destructif)
Remove-Item -Path "$env:APPDATA\Docker" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Docker" -Recurse -Force -ErrorAction SilentlyContinue

# 3. Redémarrer votre ordinateur (IMPORTANT)
# Cela réinitialise complètement le système de fichiers

# 4. Après le redémarrage, relancer Docker Desktop
# 5. Suivre les étapes de l'Étape 3 ci-dessus
```

## 📝 Après la réparation

Votre projet sera prêt à fonctionner avec :
- PostgreSQL dans Docker
- Application en mode développement (pnpm dev)
- Base de données vide mais avec le bon schéma

Lors de votre première inscription, les données de démonstration seront créées automatiquement.

## ❓ Questions fréquentes

**Q : Vais-je perdre mes données ?**
R : Oui, tous les conteneurs Docker seront supprimés. Mais comme votre projet est en développement, les données seront recréées à la première inscription.

**Q : Combien de temps ça prend ?**
R : 5-10 minutes au total (réinitialisation + redémarrage)

**Q : Faut-il vraiment redémarrer le PC ?**
R : C'est fortement recommandé pour réinitialiser complètement le système de fichiers et éviter les problèmes persistants.

**Q : Ça va casser mes autres projets Docker ?**
R : Oui, tous les conteneurs seront supprimés, mais vous pourrez les recréer facilement avec leurs fichiers docker-compose respectifs.
