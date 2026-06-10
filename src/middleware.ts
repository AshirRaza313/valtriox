import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public API routes that don't require auth cookies
const PUBLIC_API_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/me",
  "/api/auth/logout",
  "/api/auth/forgot-password",
  "/api/auth/verify-otp",
  "/api/auth/reset-password",
  "/api/health",
  "/api/public/",
  "/api/setup/init",
  "/api/lead-magnet",
  "/api/legal",
];

function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PATHS.some(p => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // Add security headers to ALL responses
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // For API routes, ensure auth cookies exist (basic check)
  // Note: Full auth verification happens in withAuth() middleware
  if (pathname.startsWith("/api/") && !isPublicApiPath(pathname)) {
    // Don't block the request - just let through (withAuth handles real verification)
    // This middleware only adds security headers
  }

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files and _next
    "/((?!_next/static|_next/image|favicon.ico|assets/|downloads/|sw.js|manifest.json|robots.txt|valtriox-.*\\.png).*)",
  ],
};
