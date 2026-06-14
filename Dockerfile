# ==========================================================================
# BrandFlow Portal — Production Dockerfile for Railway
# Node.js 22 base (for stable build + runtime), bun for fast installs
# ==========================================================================

FROM node:22-slim AS base

# Install bun for dependency installation (handles peer dep conflicts)
# Use official script — npm package shadows node/npx with broken symlinks
RUN apt-get update && apt-get install -y --no-install-recommends unzip && \
    curl -fsSL https://bun.sh/install | bash && \
    rm -rf /var/lib/apt/lists/*
ENV PATH="/root/.bun/bin:${PATH}"

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

# Prevent OOM on Railway's resource-constrained builders
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Generate Prisma client and build Next.js (Node.js runtime, not bun)
RUN ./node_modules/.bin/prisma generate && ./node_modules/.bin/next build

# Production image — minimal
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Run as non-root user
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