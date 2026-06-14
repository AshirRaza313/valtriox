# ==========================================================================
# BrandFlow Portal — Production Dockerfile for Railway
# Uses Next.js standalone output for minimal image size
# ==========================================================================

FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client (ensures it's available for build)
RUN npx prisma generate

# Build Next.js (standalone output configured in next.config.ts)
# Skip db push during build — database connection not available at build time
RUN npm run build 2>&1 || \
    (echo "Standard build failed, trying with skip-db..." && \
     npx prisma generate && npx next build)

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Run as non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy fonts (used by PDF invoice generation)
COPY --from=builder --chown=nextjs:nodejs /app/fonts ./fonts

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Railway provides PORT env var — Next.js standalone server respects it
CMD ["node", "server.js"]