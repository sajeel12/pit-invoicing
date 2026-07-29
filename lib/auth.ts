// Lightweight auth: a single shared username/password (from env) and a signed
// session cookie. Uses Web Crypto (HMAC-SHA256) so the same code runs in both
// Node route handlers and the Edge middleware — no external dependency.

export const SESSION_COOKIE = "iris_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function getSecret(): string {
  // Falls back to the FBR token so the app still works if AUTH_SECRET is unset,
  // but AUTH_SECRET should be set to a long random string in production.
  return process.env.AUTH_SECRET || process.env.FBR_TOKEN || "change-me-insecure-secret";
}

export function getCredentials(): { user: string; password: string } {
  return {
    user: process.env.LOGIN_USER || "admin",
    password: process.env.LOGIN_PASSWORD || "",
  };
}

// Constant-time-ish string compare to avoid trivial timing leaks.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function checkCredentials(user: string, password: string): boolean {
  const c = getCredentials();
  if (!c.password) return false; // login disabled until a password is configured
  return safeEqual(user, c.user) && safeEqual(password, c.password);
}

// base64url helpers that work in Edge + Node.
function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64url(sig);
}

// Token format: <payloadB64>.<signature>, payload = {u, exp}
export async function createSessionToken(user: string): Promise<string> {
  const payload = JSON.stringify({ u: user, exp: Date.now() + SESSION_TTL_MS });
  const payloadB64 = b64url(new TextEncoder().encode(payload));
  const sig = await hmac(payloadB64);
  return `${payloadB64}.${sig}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return false;
  const expected = await hmac(payloadB64);
  if (!safeEqual(sig, expected)) return false;
  try {
    const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    const { exp } = JSON.parse(json) as { u: string; exp: number };
    return typeof exp === "number" && Date.now() < exp;
  } catch {
    return false;
  }
}

export function sessionCookieOptions(maxAgeMs = SESSION_TTL_MS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000),
    secure: process.env.NODE_ENV === "production",
  };
}
