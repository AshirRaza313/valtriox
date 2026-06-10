import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 0.2, // Capture 20% of transactions

  // Session Replay
  replaysSessionSampleRate: 0.05, // 5% of sessions
  replaysOnErrorSampleRate: 0.2, // 20% of error sessions

  // Debug mode (set to true in development for testing)
  debug: false,

  // Filter out noisy errors
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "Non-Error promise rejection captured",
    "Script error",
    "NetworkError",
    "Failed to fetch",
    "Loading CSS chunk",
  ],

  // Don't send events in development
  enabled: process.env.NODE_ENV !== "development",

  // Attach user context when available
  beforeSend(event) {
    // Add environment info
    event.tags = {
      ...event.tags,
      environment: process.env.NODE_ENV,
    };
    return event;
  },
});
