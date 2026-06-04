"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { loginAction } from "./actions";

function LoginForm() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "";
  const [state, action, pending] = useActionState(loginAction, { error: "" });
  // Controlled so the values survive React's form reset when the action returns
  // (e.g. when the admin step asks for the MFA code).
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={action} className="space-y-4">
      <input name="from" type="hidden" value={from} />

      {state.needsTotp ? (
        <>
          {/* Step 2: credentials carried over, only the code is asked. */}
          <input name="username" type="hidden" value={username} />
          <input name="password" type="hidden" value={password} />
          <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-600">
            Ingresando como <strong>{username}</strong>. Ingresa tu código de verificación.
          </p>
          <div>
            <label className="text-sm font-semibold text-stone-700" htmlFor="totp">
              Código de verificación
            </label>
            <input
              autoComplete="one-time-code"
              autoFocus
              className="input mt-1 text-center text-lg tracking-[0.4em]"
              id="totp"
              inputMode="numeric"
              maxLength={6}
              name="totp"
              pattern="[0-9]*"
              placeholder="••••••"
            />
            <p className="mt-1 text-xs text-stone-400">
              Ingresa el código de 6 dígitos de tu app autenticadora.
            </p>
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="text-sm font-semibold text-stone-700" htmlFor="username">
              Usuario
            </label>
            <input
              autoCapitalize="none"
              autoComplete="username"
              className="input mt-1 text-base"
              id="username"
              name="username"
              onChange={(e) => setUsername(e.target.value)}
              required
              type="text"
              value={username}
            />
            <p className="mt-1 text-xs text-stone-400">
              El identificador de tu negocio (ej. mi-restaurante)
            </p>
          </div>

          <div>
            <label className="text-sm font-semibold text-stone-700" htmlFor="password">
              Contraseña
            </label>
            <input
              autoComplete="current-password"
              className="input mt-1 text-base"
              id="password"
              name="password"
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              value={password}
            />
          </div>
        </>
      )}

      {state.error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}

      <button className="button-gradient w-full py-3 text-base" disabled={pending} type="submit">
        {pending ? "Ingresando…" : state.needsTotp ? "Verificar código" : "Iniciar sesión"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-blue via-brand-purple to-brand-pink p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-3xl bg-white p-7 shadow-2xl">
          {/* Brand logo */}
          <div className="mb-8 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="PedidosCloud" className="h-32 w-auto object-contain" src="/brand-logo.png" />
          </div>

          <div className="mb-5 text-center">
            <p className="mt-1 text-sm text-stone-500">Inicia sesión para continuar</p>
          </div>

          <Suspense fallback={<div className="space-y-4 animate-pulse"><div className="h-10 rounded-xl bg-stone-100"/><div className="h-10 rounded-xl bg-stone-100"/><div className="h-10 rounded-xl bg-stone-100"/></div>}>
            <LoginForm />
          </Suspense>

          <p className="mt-6 text-center text-xs text-stone-400">
            ¿Problemas para ingresar?{" "}
            <span className="text-stone-500">Contacta al administrador de la plataforma.</span>
          </p>
        </div>

        <p className="mt-6 text-center text-xs font-medium text-white/80">
          © {new Date().getFullYear()} PedidosCloud
        </p>
      </div>
    </main>
  );
}
