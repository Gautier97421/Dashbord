#!/bin/sh
set -e

echo "🔄 Synchronizing Prisma schema with database..."
npx prisma db push --skip-generate --accept-data-loss

echo "✅ Database schema synchronized successfully"
echo "🚀 Starting application..."

exec "$@"
