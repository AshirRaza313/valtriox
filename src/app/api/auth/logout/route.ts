import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });

  // Phase 7: Cookie options must match login's options (secure + sameSite)
  // or the browser won't clear the correct cookie, leaving stale auth cookies.
  const cookieOptions = {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
  };

  response.cookies.set("vt-user-id", "", cookieOptions);
  response.cookies.set("vt-user-email", "", cookieOptions);
  response.cookies.set("vt-user-role", "", cookieOptions);
  response.cookies.set("vt-org-id", "", cookieOptions);
  response.cookies.set("vt-auth-sig", "", cookieOptions);

  return response;
}
