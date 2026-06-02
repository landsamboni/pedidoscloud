"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/app/actions";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, { error: "", success: false });

  if (state.success) {
    return (
      <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
        ✓ Contraseña actualizada correctamente.
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <label className="text-sm font-medium text-stone-700">
        Contraseña actual
        <input autoComplete="current-password" className="input mt-1" name="currentPassword" required type="password" />
      </label>
      <label className="text-sm font-medium text-stone-700">
        Nueva contraseña <span className="font-normal text-stone-400">(mín. 8 chars)</span>
        <input autoComplete="new-password" className="input mt-1" minLength={8} name="newPassword" required type="password" />
      </label>
      <label className="text-sm font-medium text-stone-700">
        Confirmar contraseña
        <input autoComplete="new-password" className="input mt-1" minLength={8} name="confirmPassword" required type="password" />
      </label>
      {state.error && (
        <p className="text-sm font-medium text-red-700 sm:col-span-3">{state.error}</p>
      )}
      <button className="button-secondary sm:col-span-3" disabled={pending} type="submit">
        {pending ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
