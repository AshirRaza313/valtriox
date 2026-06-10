import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 0.2,

  // Debug mode
  debug: false,

  // Don't send events in development
  enabled: process.env.NODE_ENV !== "development",
});
