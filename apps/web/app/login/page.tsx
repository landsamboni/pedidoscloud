"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { loginAction } from "./actions";

function LoginForm() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "";
  const [state, action, pending] = useActionState(loginAction, { error: "" });

  return (
    <form action={action} className="space-y-4">
      <input name="from" type="hidden" value={from} />

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
          placeholder=""
          required
          type="text"
        />
        <p className="mt-1 text-xs text-stone-400">
          El identificador de tu restaurante (ej. martica-la-bonita)
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
          required
          type="password"
        />
      </div>

      {state.error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}

      <button className="button-gradient w-full py-3 text-base" disabled={pending} type="submit">
        {pending ? "Ingresando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-blue via-brand-purple to-brand-pink p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-3xl bg-white p-7 shadow-2xl">
          {/* Brand */}
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-black tracking-tight">
              <span className="text-stone-900">Pedidos</span>
              <span className="text-brand-blue">Cloud</span>
            </h1>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-stone-400">
              Soluciones para tus pedidos, sin importar tu negocio
            </p>
          </div>

          <div className="mb-5 text-center">
            <h2 className="text-2xl font-bold text-stone-900">¡Bienvenido!</h2>
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
