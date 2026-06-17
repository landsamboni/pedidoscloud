"use client";

import { useActionState } from "react";
import { deleteRestaurant } from "@/app/actions";
import type { ActionState } from "@/app/actions";

const INIT: ActionState = { ok: true, message: "", ts: 0 };

export function DeleteRestaurantForm({ restaurantId, slug }: { restaurantId: string; slug: string }) {
  const [state, formAction, pending] = useActionState(deleteRestaurant, INIT);

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input name="restaurantId" type="hidden" value={restaurantId} />
      <input name="slug" type="hidden" value={slug} />
      <label className="block text-xs font-medium text-red-700">
        Escribe <strong>{slug}</strong> para confirmar:
        <input
          className="input mt-1 text-sm"
          name="confirmation"
          placeholder={slug}
          required
        />
      </label>
      {!state.ok && state.message && (
        <p className="text-xs font-medium text-red-600">{state.message}</p>
      )}
      <button
        className="w-full rounded-xl border-2 border-red-500 bg-red-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Eliminando…" : "Eliminar restaurante"}
      </button>
    </form>
  );
}
