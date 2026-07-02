import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";

// GET /api/subscriptions/payoneer - Payoneer gateway configuration info
// Phase 6: Added auth requirement — gateway metadata should not be public
export const GET = withRateLimit(withAuth(async (_req: NextRequest, _authCtx) => {
  return NextResponse.json({
    gateway: "payoneer",
    name: "Payoneer",
    description: "International payment gateway for USD transfers and recurring subscriptions",
    supportedMethods: ["bank_transfer", "credit_card", "local_withdrawal"],
    status: "active",
    note: "Payoneer settings are managed via Payment Gateways settings page (Platform Settings).",
  });
}), { maxRequests: 60, windowSeconds: 60 });
