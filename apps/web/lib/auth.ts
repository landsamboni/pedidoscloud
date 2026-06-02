/**
 * Session management for PedidosCloud operator auth.
 *
 * Uses a signed JWT stored in an HttpOnly cookie so that:
 * - Edge Runtime (middleware) can verify the session without DB calls.
 * - Node.js runtime (Server Actions, Server Components) can read session data.
 *
 * AUTH_SECRET must be a 32+ char random string set as an env var (Amplify
 * branch-level). Generate one with: openssl rand -base64 32
 */
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

export const COOKIE_NAME = "pcloud_session";
const SESSION_TTL_HOURS = 12;

export type SessionPayload = {
  role: "admin" | "restaurant";
  restaurantSlug?: string;          // only for role=restaurant
  subscriptionEndsAt?: string;      // ISO string — checked in middleware without DB
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    // Warn loudly in development; fail in production.
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET env var is not set. Set it in Amplify environment variables.");
    }
    console.warn("[auth] AUTH_SECRET not set — using an insecure dev fallback. Set AUTH_SECRET in production.");
    return new TextEncoder().encode("dev-fallback-secret-change-me-in-production-32chars");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_HOURS}h`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_HOURS * 60 * 60,
    path: "/",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return token ? verifyToken(token) : null;
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** Verify a raw JWT string. Used in middleware (Edge Runtime) and server code. */
export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as SessionPayload;
  } catch {
    return null;
  }
}
