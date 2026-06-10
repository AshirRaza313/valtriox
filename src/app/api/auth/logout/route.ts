import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });

  // Clear all auth cookies
  const cookieOptions = { path: "/", maxAge: 0, httpOnly: true };

  response.cookies.set("vt-user-id", "", cookieOptions);
  response.cookies.set("vt-user-email", "", cookieOptions);
  response.cookies.set("vt-user-role", "", cookieOptions);
  response.cookies.set("vt-org-id", "", cookieOptions);
  response.cookies.set("vt-auth-sig", "", cookieOptions);

  return response;
}
