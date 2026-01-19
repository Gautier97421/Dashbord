#!/bin/bash
set -e

# Attendre que PostgreSQL soit prêt
until pg_isready -U postgres; do
  echo "Waiting for PostgreSQL..."
  sleep 1
done

# Modifier pg_hba.conf pour trust
echo "host all all 0.0.0.0/0 trust" >> /var/lib/postgresql/data/pg_hba.conf

# Recharger la configuration
psql -U postgres -c "SELECT pg_reload_conf();"

echo "PostgreSQL configured for trust authentication"
