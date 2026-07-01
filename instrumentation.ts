// Next.js instrumentation file for Sentry
// This file enables Sentry's automatic instrumentation for server-side performance monitoring
// See: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

import { validateEnv } from "@/lib/env";

export async function register() {
  // Phase 6: Validate environment variables at startup
  validateEnv();

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
