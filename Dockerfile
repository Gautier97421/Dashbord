FROM node:20-bookworm-slim AS base
# Install dependencies needed for Prisma native engines (OpenSSL)
RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.19.0

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install pnpm in builder
RUN npm install -g pnpm@10.19.0

# Generate Prisma Client (after copying all files including prisma/)
# Use a dummy DATABASE_URL for the build stage since Prisma 7 requires it in config
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Download the Prisma schema engine now (pnpm skips its postinstall), so that
# `prisma db push` in the entrypoint works offline and as the non-root user
RUN npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > /dev/null

# Build the application
ENV NEXT_TELEMETRY_DISABLED=1
ENV ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
RUN pnpm build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy Prisma files first (l'entrypoint lance « npx prisma db push » depuis node_modules)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Entrypoint syncs the Prisma schema with the database before starting
# (CRLF -> LF in case the file was checked out on Windows)
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

# Fichiers joints aux projets : dossier monté en volume (docker-compose), inscriptible par l'app
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads
ENV UPLOAD_DIR=/app/uploads

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
