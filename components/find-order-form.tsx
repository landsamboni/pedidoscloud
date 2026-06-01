"use client";

import { useActionState } from "react";
import { findTodayOrder } from "@/app/actions";

const initialState = { error: "" };

export function FindOrderForm({ restaurantSlug }: { restaurantSlug: string }) {
  const [state, action, pending] = useActionState(findTodayOrder, initialState);

  return (
    <details className="card mb-4 border-amber-200 bg-amber-50">
      <summary className="cursor-pointer text-lg font-bold text-amber-950">¿Ya hiciste un pedido? Revisa su estado</summary>
      <p className="mt-3 text-sm leading-relaxed text-amber-950">Escribe el número que recibiste y el mismo teléfono que usaste al pedir.</p>
      <form action={action} className="mt-4 space-y-3">
        <input name="restaurantSlug" type="hidden" value={restaurantSlug} />
        <input className="input text-base" inputMode="numeric" name="orderNumber" placeholder="Número de pedido, por ejemplo 008" required />
        <input className="input text-base" inputMode="tel" name="phone" placeholder="Teléfono" required />
        {state.error && <p className="text-sm font-semibold text-red-700">{state.error}</p>}
        <button className="button-primary w-full py-3 text-base" disabled={pending}>
          {pending ? "Buscando..." : "Revisar mi pedido"}
        </button>
      </form>
    </details>
  );
}
