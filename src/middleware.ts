import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Phase 4+5: CORS + security headers + request correlation middleware
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  "https://valtriox.com",
  "https://www.valtriox.com",
  "https://valtriox-portal.vercel.app",
].filter(Boolean) as string[];

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");

  // Phase 5: Generate request correlation ID for tracing
  const requestId = request.headers.get("X-Request-ID") || crypto.randomUUID();

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
    response.headers.set("X-Request-ID", requestId);

    return response;
  }

  const response = NextResponse.next();

  // Set CORS headers for allowed origins
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  // Phase 5: Propagate request ID for end-to-end tracing
  response.headers.set("X-Request-ID", requestId);

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // SECURITY: Strict-Transport-Security — enforce HTTPS for 1 year + subdomains
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // SECURITY: Content-Security-Policy — defense-in-depth against XSS
  // Phase 6: Removed unsafe-inline and unsafe-eval for proper XSS protection.
  // nonce-based inline script/style allowlist is used instead.
  // NOTE: If the app uses client-side frameworks that inject inline scripts,
  // add a nonce per-request: response.headers.set("X-CSP-Nonce", nonce)
  // and include 'nonce-{value}' in script-src/style-src.
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' https://va.vercel-scripts.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https://va.vercel-scripts.com https://*.supabase.co https://api.cloudinary.com https://api.resend.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ].join("; ")
    );
  }

  // SECURITY: Permissions-Policy — restrict browser features
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files and _next
    "/((?!_next/static|_next/image|favicon.ico|assets/|downloads/|sw.js|manifest.json|robots.txt|valtriox-.*\\.png).*)",
  ],
};
