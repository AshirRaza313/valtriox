import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Phase 4: CORS + security headers middleware
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  "https://valtriox.com",
  "https://www.valtriox.com",
  "https://valtriox-portal.vercel.app",
].filter(Boolean) as string[];

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");

  // Handle CORS preflight requests
  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });

    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Credentials", "true");
    }

    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID");
    response.headers.set("Access-Control-Max-Age", "86400");

    return response;
  }

  const response = NextResponse.next();

  // Set CORS headers for allowed origins
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  // Security headers (supplement what next.config.ts and vercel.json provide)
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files and _next
    "/((?!_next/static|_next/image|favicon.ico|assets/|downloads/|sw.js|manifest.json|robots.txt|valtriox-.*\\.png).*)",
  ],
};
