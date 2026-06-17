"use client";

import { useState } from "react";
import { logoutAction } from "@/app/login/actions";

export function LogoutButton({
  className = "button-danger",
  vertical = false,
}: {
  className?: string;
  vertical?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return vertical ? (
      // Vertical layout for narrow containers (e.g. sidebar)
      <div className="space-y-1.5 rounded-lg bg-slate-800 p-2">
        <p className="text-xs font-medium text-slate-400 px-1">¿Cerrar sesión?</p>
        <div className="flex gap-1.5">
          <form action={logoutAction} className="flex-1">
            <button className="w-full rounded-lg bg-red-600 px-2 py-1.5 text-xs font-bold text-white transition hover:bg-red-700" type="submit">
              Sí, salir
            </button>
          </form>
          <button
            className="flex-1 rounded-lg bg-slate-700 px-2 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-600"
            onClick={() => setConfirming(false)}
            type="button"
          >
            Cancelar
          </button>
        </div>
      </div>
    ) : (
      // Horizontal layout (default — page headers)
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-stone-600">¿Cerrar sesión?</span>
        <form action={logoutAction}>
          <button className="button-danger text-sm" type="submit">Sí, salir</button>
        </form>
        <button
          className="button-secondary text-sm"
          onClick={() => setConfirming(false)}
          type="button"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button className={className} onClick={() => setConfirming(true)} type="button">
      Cerrar sesión
    </button>
  );
}
