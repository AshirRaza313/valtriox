import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Phase 4+5: CORS + security headers + request correlation middleware
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  "https://valtriox.com",
  "https://www.valtriox.com",
  "https://valtriox-portal.vercel.app",
].filter(Boolean) as string[];

// Generate a cryptographically random nonce for CSP
function generateNonce(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64");
}

export function middleware(request: NextRequest) {
  try {
    // ── SEO: WWW Canonicalization ──────────────────────────────────────────
    const host = request.headers.get("host") || "";
    if (process.env.NODE_ENV === "production" && host === "www.valtriox.com") {
      const url = request.nextUrl.clone();
      url.host = "valtriox.com";
      url.protocol = "https:";
      const redirect = NextResponse.redirect(url, 301);
      redirect.headers.set("X-Content-Type-Options", "nosniff");
      redirect.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
      if (process.env.NODE_ENV === "production") {
        redirect.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
      }
      return redirect;
    }

    const origin = request.headers.get("origin");
    const nonce = generateNonce();
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

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("X-Request-ID", requestId);

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });

    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Credentials", "true");
    }

    response.headers.set("X-Request-ID", requestId);
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    if (process.env.NODE_ENV === "production") {
      response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
      response.headers.set(
        "Content-Security-Policy",
        [
          "default-src 'self'",
          `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://va.vercel-scripts.com https://connect.facebook.net https://www.googletagmanager.com`,
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          "img-src 'self' data: blob: https: https://www.facebook.com",
          "connect-src 'self' https://va.vercel-scripts.com https://*.supabase.co https://api.cloudinary.com https://api.resend.com https://www.facebook.com https://www.google-analytics.com https://graph.facebook.com",
          "frame-src https://www.facebook.com https://calendly.com https://*.calendly.com",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "object-src 'none'",
        ].join("; ")
      );
    }

    response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    return response;
  } catch (error) {
    // Fail open to prevent MIDDLEWARE_INVOCATION_FAILED 500s
    console.error("Middleware Error:", error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|assets/|downloads/|sw.js|manifest.json|robots.txt|valtriox-.*\\.png).*)",
  ],
};