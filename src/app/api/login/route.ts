import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, parseBody, route } from "@/lib/api";
import { logger } from "@/lib/logger";
import { createSessionToken, passwordMatches, SESSION_COOKIE, SESSION_MAX_AGE_S } from "@/lib/session";

const body = z.object({ password: z.string().min(1, "password is required") });

export const POST = route("POST /api/login", async (req) => {
  const secret = process.env.APP_PASSWORD;
  if (!secret) throw new ApiError(503, "NOT_CONFIGURED", "APP_PASSWORD is not set on the server.");
  const { password } = await parseBody(req, body);
  if (!(await passwordMatches(password, secret))) {
    logger.warn("login failed");
    throw new ApiError(401, "WRONG_PASSWORD", "Wrong password.");
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  logger.info("login ok");
  return res;
});
