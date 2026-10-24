#!/bin/sh
# Sauvegarde de la base DashLife sur le VPS (à planifier chaque nuit, voir DEPLOY-VPS.md).
# Garde 14 jours de sauvegardes compressées dans ./backups (lisibles uniquement par leur propriétaire).
set -eu
cd "$(dirname "$0")/.."

mkdir -p backups
chmod 700 backups
file="backups/dashlife-$(date +%Y%m%d-%H%M%S).sql.gz"

umask 077
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres \
  pg_dump -U dashlife -d dashlife --no-owner --no-acl | gzip > "$file"

# Une sauvegarde vide signale un échec (base arrêtée…) : on ne la garde pas
if [ "$(gzip -dc "$file" | head -c 100 | wc -c)" -lt 100 ]; then
  rm -f "$file"
  echo "Échec : sauvegarde vide" >&2
  exit 1
fi

# Fichiers joints aux projets et tâches (volume uploads_data)
uploads="backups/uploads-$(date +%Y%m%d-%H%M%S).tar.gz"
if docker compose -f docker-compose.prod.yml --env-file .env.production exec -T app tar -czf - -C /app/uploads . > "$uploads"; then
  echo "Fichiers : $uploads"
else
  rm -f "$uploads"
  echo "Attention : fichiers joints non sauvegardés" >&2
fi

find backups -name 'dashlife-*.sql.gz' -mtime +14 -delete
find backups -name 'uploads-*.tar.gz' -mtime +14 -delete
echo "Sauvegarde : $file"
