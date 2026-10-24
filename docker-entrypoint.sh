#!/bin/sh
set -e

echo "Synchronizing Prisma schema with database..."
# En local, PRISMA_ACCEPT_DATA_LOSS=true laisse passer les changements destructifs du schéma.
# En production il n'est pas défini : un changement qui supprimerait des données fait échouer le
# démarrage au lieu d'effacer silencieusement (faire une sauvegarde, puis migrer à la main).
if [ "$PRISMA_ACCEPT_DATA_LOSS" = "true" ]; then
  npx prisma db push --skip-generate --accept-data-loss
else
  npx prisma db push --skip-generate
fi

echo "Database schema synchronized successfully"
echo "Starting application..."

exec "$@"
