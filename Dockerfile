# ==========================================================================
# BrandFlow Portal — Production Dockerfile for Railway
# bun (deps only) + node:22-slim (build + runtime)
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
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=4096"
# Use --webpack: Turbopack doesn't support output:"standalone"
RUN ./node_modules/.bin/prisma generate && ./node_modules/.bin/next build --webpack
# Debug: check what next build actually output
RUN echo "=== .next/ contents ===" && ls -la .next/ && echo "=== standalone ===" && ls -la .next/standalone/ 2>/dev/null || echo "NO standalone dir"

# Stage 3: Production — minimal Node.js image
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs --no-create-home nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/fonts ./fonts

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]