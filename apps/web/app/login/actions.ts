"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, clearSession } from "@/lib/auth";

export type LoginState = { error: string };

export async function loginAction(_: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const from     = String(formData.get("from") ?? "").trim();

  if (!username || !password) {
    return { error: "Ingresa tu usuario y contraseña." };
  }

  // Admin login — credentials from env vars (no DB, no bcrypt)
  const adminUser = process.env.ADMIN_USER ?? "admin";
  const adminPass = process.env.ADMIN_PASSWORD ?? "";
  if (username === adminUser) {
    if (!adminPass || password !== adminPass) return { error: "Credenciales inválidas." };
    await createSession({ role: "admin" });
    redirect(from && from.startsWith("/admin") ? from : "/admin");
  }

  // Restaurant login — credentials from DB
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: username },
    select: { slug: true, active: true, passwordHash: true },
  });

  if (!restaurant || !restaurant.active) return { error: "Credenciales inválidas." };
  if (!restaurant.passwordHash) {
    return { error: "Este restaurante aún no tiene contraseña. Contacta al administrador." };
  }

  const { compare } = await import("bcryptjs");
  const valid = await compare(password, restaurant.passwordHash);
  if (!valid) return { error: "Credenciales inválidas." };

  await createSession({ role: "restaurant", restaurantSlug: restaurant.slug });
  const dest = from && from.startsWith(`/restaurant/${username}`) ? from : `/restaurant/${username}`;
  redirect(dest);
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/login");
}
