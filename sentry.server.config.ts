import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 0.2,

  // Debug mode
  debug: false,

  // Don't send events in development
  enabled: process.env.NODE_ENV !== "development",

  // Filter out noisy server errors
  ignoreErrors: [
    "prisma.*P2021.*", // Prisma table not found (expected during initial setup)
    "prisma.*P2002.*", // Prisma unique constraint (handled in API routes)
    "NEXT_REDIRECT", // Next.js internal redirect errors
  ],

  // Profiling
  profilesSampleRate: 0.1, // 10% of profiles

  beforeSend(event) {
    event.tags = {
      ...event.tags,
      environment: process.env.NODE_ENV,
      runtime: "server",
    };
    return event;
  },
});
