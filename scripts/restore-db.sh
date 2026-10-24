#!/bin/sh
# Restaure une sauvegarde (ou l'export de la base locale) dans la base du VPS.
#   ./scripts/restore-db.sh backups/dashlife-AAAAMMJJ-HHMMSS.sql.gz
#   ./scripts/restore-db.sh dashlife-local.sql
# ATTENTION : remplace tout le contenu actuel de la base. L'app est arrêtée pendant l'opération.
set -eu
cd "$(dirname "$0")/.."

file="${1:?Usage : $0 <fichier .sql ou .sql.gz>}"
[ -f "$file" ] || { echo "Fichier introuvable : $file" >&2; exit 1; }

compose="docker compose -f docker-compose.prod.yml --env-file .env.production"

printf "Remplacer TOUTES les données de la base par %s ? Tape OUI pour confirmer : " "$file"
read -r answer
[ "$answer" = "OUI" ] || { echo "Annulé."; exit 1; }

$compose stop app cron
$compose up -d postgres

# Base vidée puis rechargée depuis le fichier
$compose exec -T postgres psql -U dashlife -d dashlife -v ON_ERROR_STOP=1 \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
case "$file" in
  *.gz) gzip -dc "$file" ;;
  *) cat "$file" ;;
esac | $compose exec -T postgres psql -U dashlife -d dashlife -v ON_ERROR_STOP=1 -q

$compose up -d app cron
echo "Restauration terminée."
