# ==========================================================================
# BrandFlow Portal — Production Dockerfile for Railway
# Uses bun for fast installs, Next.js standalone output
# ==========================================================================

FROM oven/bun:1 AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy lockfile, package.json, and prisma schema (needed by postinstall)
COPY bun.lock package.json ./
COPY prisma ./prisma/

# Install dependencies (bun handles peer dep conflicts gracefully)
RUN bun install --frozen-lockfile

# Build the application
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prevent SIGSEGV/OOM on Railway's resource-constrained builders
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Generate Prisma client and build Next.js
RUN bunx prisma generate && bun run build

# Production image — minimal
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Run as non-root user (Debian uses groupadd/useradd, not Alpine's addgroup/adduser)
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs --no-create-home nextjs

# Copy standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy fonts (PDF invoice generation)
COPY --from=builder --chown=nextjs:nodejs /app/fonts ./fonts

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]