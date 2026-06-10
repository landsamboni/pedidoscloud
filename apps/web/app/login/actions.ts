"use server";

import { timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, clearSession } from "@/lib/auth";
import { rateLimit, rateLimitReset } from "@/lib/rate-limit";

// Brute-force throttle: max attempts per username per window (best-effort,
// per-instance — Cloudflare Rate Limiting on /login is the authoritative control).
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export type LoginState = { error: string; needsTotp?: boolean };

/** Constant-time string comparison — avoids leaking the admin password via timing. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function loginAction(_: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const from     = String(formData.get("from") ?? "").trim();

  if (!username || !password) {
    return { error: "Ingresa tu usuario y contraseña." };
  }

  const throttle = rateLimit(`login:${username}`, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS);
  if (!throttle.allowed) {
    return { error: `Demasiados intentos. Espera ${throttle.retryAfterSeconds} s e intenta de nuevo.` };
  }

  // Admin login — credentials from env vars (no DB, no bcrypt)
  const adminUser = process.env.ADMIN_USER ?? "admin";
  const adminPass = process.env.ADMIN_PASSWORD ?? "";
  if (username === adminUser) {
    if (!adminPass || !safeEqual(password, adminPass)) return { error: "Credenciales inválidas." };

    // Optional MFA: only enforced when ADMIN_TOTP_SECRET is configured.
    const totpSecret = process.env.ADMIN_TOTP_SECRET;
    if (totpSecret) {
      const code = String(formData.get("totp") ?? "").replace(/\s/g, "");
      if (!code) return { error: "", needsTotp: true };
      const { authenticator } = await import("otplib");
      if (!authenticator.verify({ token: code, secret: totpSecret })) {
        return { error: "Código de verificación incorrecto.", needsTotp: true };
      }
    }

    rateLimitReset(`login:${username}`);
    await createSession({ role: "admin" });
    redirect(from && from.startsWith("/admin") ? from : "/admin");
  }

  // Restaurant login — credentials from DB
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: username },
    select: { slug: true, active: true, passwordHash: true, subscriptionEndsAt: true },
  });

  if (!restaurant || !restaurant.active) return { error: "Credenciales inválidas." };
  if (!restaurant.passwordHash) {
    return { error: "Este restaurante aún no tiene contraseña. Contacta al administrador." };
  }

  const { compare } = await import("bcryptjs");
  const valid = await compare(password, restaurant.passwordHash);
  if (!valid) return { error: "Credenciales inválidas." };

  rateLimitReset(`login:${username}`);
  await createSession({
    role: "restaurant",
    restaurantSlug: restaurant.slug,
    subscriptionEndsAt: restaurant.subscriptionEndsAt?.toISOString(),
  });
  const dest = from && from.startsWith(`/restaurant/${username}`) ? from : `/restaurant/${username}`;
  redirect(dest);
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/login");
}
