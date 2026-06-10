import { NextResponse } from "next/server";

// GET /api/subscriptions/payoneer - Payoneer gateway configuration info
export async function GET() {
  return NextResponse.json({
    gateway: "payoneer",
    name: "Payoneer",
    description: "International payment gateway for USD transfers and recurring subscriptions",
    supportedMethods: ["bank_transfer", "credit_card", "local_withdrawal"],
    webhookEndpoint: "/api/subscriptions/payoneer/webhook",
    status: "active",
    note: "Payoneer settings are managed via Payment Gateways settings page (Platform Settings).",
  });
}
