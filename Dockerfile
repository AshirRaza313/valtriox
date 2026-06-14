# ==========================================================================
# BrandFlow Portal — Production Dockerfile for Railway
# bun (deps) + node:22-slim (build + runtime)
# Uses next start (not standalone) for maximum compatibility
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

# Stage 3: Production — full .next + node_modules (no standalone)
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/* && \
    groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs --no-create-home nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/fonts ./fonts
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["npx", "next", "start"]