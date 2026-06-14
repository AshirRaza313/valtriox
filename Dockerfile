# ==========================================================================
# BrandFlow Portal — Production Dockerfile for Railway
# bun (deps) + node:22-slim (build + runtime)
# Uses standalone output — Railway start command: node .next/standalone/server.js
# ==========================================================================

# Stage 1: Install dependencies with bun (handles peer dep conflicts)
FROM oven/bun:1 AS deps
WORKDIR /app
COPY bun.lock package.json ./
COPY prisma ./prisma/
RUN bun install --frozen-lockfile

# Stage 2: Build with Node.js (stable, no SIGSEGV)
FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN ./node_modules/.bin/prisma generate && ./node_modules/.bin/next build --webpack

# Stage 3: Production — standalone output
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/* && \
    groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs --no-create-home nextjs

# Copy standalone output (includes its own node_modules for server code)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static assets into the correct location within standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy fonts and prisma (needed by API routes for PDF generation & DB)
COPY --from=builder --chown=nextjs:nodejs /app/fonts ./fonts
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Railway start command override: node .next/standalone/server.js
# Standalone puts server.js at the WORKDIR root, so path is ./server.js
CMD ["node", "server.js"]