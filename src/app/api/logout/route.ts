import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/session";

export const POST = route("POST /api/logout", async () => {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
});
