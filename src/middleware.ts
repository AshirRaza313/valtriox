import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Security headers are set in next.config.ts and vercel.json
// This middleware is kept lightweight — only for future auth/routing logic

export function middleware(request: NextRequest) {
  // Let all requests pass through
  // Security headers are handled by next.config.ts headers() and vercel.json
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files and _next
    "/((?!_next/static|_next/image|favicon.ico|assets/|downloads/|sw.js|manifest.json|robots.txt|valtriox-.*\\.png).*)",
  ],
};