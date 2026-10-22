// Simple signed-cookie gate. NOT real authentication: one shared password, no user accounts.
// Uses Web Crypto so it runs in both the proxy and route handlers.

export const SESSION_COOKIE = "fr_session";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 7;

const enc = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(secret: string): Promise<string> {
  const exp = String(Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_S);
  return `${exp}.${await hmacHex(secret, exp)}`;
}

export async function verifySessionToken(token: string | undefined, secret: string | undefined): Promise<boolean> {
  if (!token || !secret) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, await hmacHex(secret, exp));
}

export async function passwordMatches(input: string, secret: string): Promise<boolean> {
  // Compare HMAC digests so length and timing do not leak the password.
  return safeEqual(await hmacHex("login-compare", input), await hmacHex("login-compare", secret));
}
