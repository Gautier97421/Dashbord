# Mettre DashLife en ligne sur un VPS

Résultat : l'app accessible en HTTPS sur ton propre nom de domaine, installable comme une application
sur ton téléphone et ton ordinateur, avec tes données actuelles reprises.

Ce qui tourne sur le serveur (`docker-compose.prod.yml`) :

| Service | Rôle | Exposé sur Internet |
|---|---|---|
| `caddy` | HTTPS automatique (certificat Let's Encrypt renouvelé tout seul) | oui, ports 80 et 443 |
| `app` | DashLife | non, seulement via Caddy |
| `postgres` | Base de données | non, réseau interne sans accès à Internet |
| `cron` | Lance les workflows automatiques toutes les 5 minutes | non, réseau interne |

## 1. Ce qu'il te faut

- **Un VPS** sous Ubuntu 24.04 avec **2 Go de RAM minimum** (ex. Hetzner CX22, OVH VPS-1 : environ 4 à 6 € par mois).
- **Un nom de domaine** (ou un sous-domaine d'un domaine que tu as déjà), par ex. `dashlife.ton-domaine.fr`.
- **Une clé API Anthropic** pour le scan de plats/étiquettes et l'agent mail : [platform.claude.com](https://platform.claude.com).
  Fixe une limite de dépenses mensuelle dans la console (voir « Coût de l'IA » plus bas).

## 2. Faire pointer le domaine vers le serveur

Chez ton fournisseur de domaine, crée un enregistrement DNS **A** : `dashlife` → l'adresse IPv4 du VPS.
Vérifie depuis ton PC (PowerShell) : `Resolve-DnsName dashlife.ton-domaine.fr` doit renvoyer l'IP du VPS.

## 3. Sécuriser le serveur (une fois)

Connecte-toi en SSH avec le compte fourni, puis :

```bash
# Utilisateur dédié (remplace "gautier")
adduser gautier && usermod -aG sudo gautier

# Connexion par clé uniquement : depuis ton PC, envoie ta clé publique
#   ssh-copy-id gautier@IP_DU_VPS     (ou copie ~/.ssh/id_ed25519.pub dans ~/.ssh/authorized_keys)
# puis, sur le serveur, interdis les mots de passe et la connexion root :
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/; s/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh

# Pare-feu : SSH + web uniquement
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443 && sudo ufw enable

# Mises à jour de sécurité automatiques
sudo apt update && sudo apt install -y unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades
```

> Teste la connexion par clé dans un **second** terminal avant de fermer le premier.
> Docker ouvre lui-même les ports qu'il publie, sans passer par `ufw` : ici seuls 80 et 443 (Caddy)
> sont publiés, la base de données ne l'est jamais.

## 4. Installer Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # puis déconnecte-toi / reconnecte-toi
docker compose version          # doit afficher une version 2.x
```

## 5. Récupérer le code

```bash
git clone <url-de-ton-dépôt> ~/dashlife && cd ~/dashlife
```

(Dépôt privé : ajoute une « deploy key » en lecture seule sur GitHub, ou copie le dossier avec
`scp -r` depuis ton PC, sans `node_modules` ni `.next`.)

## 6. Configurer

```bash
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

- `DOMAIN`, `ACME_EMAIL` : ton domaine et ton e-mail.
- `POSTGRES_PASSWORD` : `openssl rand -hex 24` (uniquement hexadécimal).
- `NEXTAUTH_SECRET`, `CRON_SECRET` : `openssl rand -hex 32` chacun.
- `ENCRYPTION_KEY` : **la même valeur que dans ton `.env` local**, sinon tes connexions Gmail/GitHub…
  reprises de la base locale seront illisibles (il faudrait les refaire).
- `ANTHROPIC_API_KEY` : ta clé API.
- `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` : les mêmes qu'en local.
- `ALLOW_REGISTRATION=false` : personne d'autre ne peut créer de compte.
  Pour inviter des amis (voyages partagés) : `ALLOW_REGISTRATION=true` et `REGISTRATION_INVITE_CODE=…`
  (`openssl rand -hex 6`). Seuls ceux à qui tu donnes ce code peuvent s'inscrire ; change-le ou
  repasse à `false` une fois tout le monde inscrit.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` : notifications push des projets sur ton téléphone.
  Génère la paire une fois avec `npx web-push generate-vapid-keys` et ne la change plus (en changer
  désabonne tous les appareils).

## 7. Reprendre tes données locales

Sur ton PC (PowerShell, dans le dossier du projet, avec l'app locale démarrée) :

```powershell
.\scripts\export-local-db.ps1
scp dashlife-local.sql gautier@IP_DU_VPS:~/dashlife/
Remove-Item dashlife-local.sql   # le fichier contient toutes tes données
```

Sur le serveur :

```bash
cd ~/dashlife
docker compose -f docker-compose.prod.yml --env-file .env.production build
chmod +x scripts/*.sh
./scripts/restore-db.sh dashlife-local.sql   # tape OUI pour confirmer
rm dashlife-local.sql
```

## 8. Démarrer

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml logs -f app caddy   # Ctrl+C pour quitter
```

Ouvre `https://ton-domaine` : le cadenas HTTPS apparaît après quelques secondes (premier certificat).
Connecte-toi avec ton compte habituel.

## 9. Google (Gmail)

Dans la console Google Cloud → Identifiants → ton client OAuth → **URI de redirection autorisés**,
ajoute `https://ton-domaine/api/gmail/auth/callback` (garde les adresses locales pour le dev).
Même principe pour les autres intégrations : `https://ton-domaine/api/<service>/auth/callback`.

## 10. Installer l'app

- **Android (Chrome)** : menu ⋮ → « Installer l'application ».
- **iPhone (Safari)** : bouton Partager → « Sur l'écran d'accueil ».
- **Ordinateur (Chrome / Edge)** : icône d'installation dans la barre d'adresse, ou Paramètres → « Installer l'app ».

Les données se synchronisent entre appareils au retour sur l'app et toutes les 30 secondes.

Notifications (retards, échéances, tâches bloquées, projets à l'arrêt) : dans l'app installée,
Paramètres → Notifications → « Recevoir les notifications ici », sur chaque appareil. Sur iPhone,
elles ne fonctionnent que depuis l'app ajoutée à l'écran d'accueil (iOS 16.4 ou plus récent).
Elles sont calculées par le service `cron` toutes les 5 minutes, jamais pendant les heures calmes.

## 11. Sauvegardes (indispensable)

Sauvegarde chaque nuit à 3 h (base + fichiers joints aux projets), 14 jours conservés dans `~/dashlife/backups` :

```bash
crontab -e
# ajoute la ligne :
0 3 * * * /home/gautier/dashlife/scripts/backup-db.sh >> /home/gautier/dashlife/backups/backup.log 2>&1
```

Garde aussi une copie **hors du serveur** (si le VPS disparaît, les sauvegardes aussi). Depuis ton PC :

```powershell
scp -r gautier@IP_DU_VPS:~/dashlife/backups .\sauvegardes-dashlife
```

Restaurer une sauvegarde : `./scripts/restore-db.sh backups/dashlife-AAAAMMJJ-HHMMSS.sql.gz`.

## 12. Mettre à jour l'app

```bash
cd ~/dashlife
./scripts/backup-db.sh
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Si une mise à jour modifie la base au point de supprimer des données, l'app **refuse de démarrer**
au lieu d'effacer quoi que ce soit (`docker compose ... logs app` le montre). Dans ce cas, garde la
sauvegarde, et migre le schéma à la main avant de relancer.

## Coût de l'IA

Le modèle par défaut est Claude Haiku 5.5, le plus économique. Ordre de grandeur :

| Usage | Haiku 5.5 (défaut) | Opus 5.5 |
|---|---|---|
| Un scan de plat ou d'étiquette | moins de 0,1 centime | ~3 centimes |
| Tri d'un lot de mails (seulement si `AI_EMAIL_PROVIDER=claude`) | quelques centièmes de centime | quelques centimes |

Si les plats complexes sont mal reconnus, essaie `ANTHROPIC_MODEL=claude-sonnet-5-5` ou
`claude-opus-5-5` dans `.env.production`, puis relance `up -d`. Dans tous les cas, fixe une limite de
dépenses dans la console Anthropic.

Garde-fou intégré : 60 appels à l'IA par heure et par compte au plus (scans, agent, workflows). Au-delà,
l'app répond « Trop d'appels à l'IA cette heure-ci ».

## Confidentialité des données

| Donnée | Où elle est traitée |
|---|---|
| Photos de plats et d'étiquettes | API Anthropic (Claude) |
| Contenu des mails (tri, candidatures, rendez-vous, factures jointes, demandes à l'agent) | **Sur ton serveur uniquement** par défaut (`AI_EMAIL_PROVIDER=none`) |
| Tout le reste (tâches, notes, abonnements, nutrition…) | Sur ton serveur, dans la base PostgreSQL |

Avec `AI_EMAIL_PROVIDER=none`, l'agent mail fonctionne avec des règles locales :

- **Tri** : d'après les catégories de Gmail (Promotions, Réseaux sociaux, Notifications) et les mots importants.
- **Candidatures** : détectées par mots-clés (« votre candidature a bien été reçue »…).
- **Abonnements** : déjà détectés sans IA (mots-clés + lecture des PDF de factures sur le serveur).
- **Rendez-vous** : pas de détection automatique dans les mails.

`AI_EMAIL_PROVIDER=claude` améliore le tri, mais envoie l'expéditeur, l'objet et le début des mails à
Anthropic. `AI_EMAIL_PROVIDER=ollama` utilise l'IA de ton PC (les mails restent chez toi), mais
seulement quand le PC est allumé et joignable depuis le serveur (par exemple via Tailscale).

## Dépannage

```bash
docker compose -f docker-compose.prod.yml ps                    # état des services
docker compose -f docker-compose.prod.yml logs --tail 100 app   # erreurs de l'app
docker compose -f docker-compose.prod.yml logs --tail 50 caddy  # certificat HTTPS
docker compose -f docker-compose.prod.yml logs --tail 20 cron   # workflows automatiques
```

- **Pas de HTTPS** : le DNS ne pointe pas encore vers le VPS, ou les ports 80/443 sont fermés chez l'hébergeur.
- **« Trop de tentatives de connexion »** : 5 échecs en 15 minutes sur un compte ; attendre, ou redémarrer l'app.
- **Scan indisponible** : vérifier `ANTHROPIC_API_KEY` et la limite de dépenses de la console Anthropic.
- **Notifications Gmail en temps réel** : le webhook exige `GMAIL_WEBHOOK_TOKEN` (sinon il est refusé) ;
  sans Pub/Sub, les mails sont de toute façon relus toutes les 5 minutes par le service `cron`.
