import { NextResponse } from "next/server";

// Health check endpoint - no sensitive data exposed
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "valtriox-portal",
    timestamp: new Date().toISOString(),
  });
}
