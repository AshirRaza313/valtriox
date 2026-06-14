# ==========================================================================
# BrandFlow Portal — Production Dockerfile for Railway
# Uses bun for fast installs, Next.js standalone output
# ==========================================================================

FROM oven/bun:1 AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy lockfile and package.json first (better cache)
COPY bun.lock package.json ./

# Install dependencies (bun handles peer dep conflicts gracefully)
RUN bun install --frozen-lockfile

# Generate Prisma Client
RUN bunx prisma generate

# Build the application
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client and build Next.js
RUN bunx prisma generate && bun run build

# Production image — minimal
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

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