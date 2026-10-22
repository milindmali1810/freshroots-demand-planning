import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function proxy(req: NextRequest) {
  if (await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value, process.env.APP_PASSWORD)) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Log in first." } }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

// /login, the login/logout endpoints and /api/health stay open.
export const config = {
  matcher: ["/((?!login|api/login|api/logout|api/health|_next/static|_next/image|favicon.ico).*)"],
};
