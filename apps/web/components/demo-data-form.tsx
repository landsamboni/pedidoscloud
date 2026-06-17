"use client";

import { useActionState } from "react";
import { populateDemoDataUniversal } from "@/app/actions";
import type { ActionState } from "@/app/actions";

const INIT: ActionState = { ok: false, message: "", ts: 0 };

export function DemoDataForm({ restaurantId }: { restaurantId: string }) {
  const [state, action, pending] = useActionState(populateDemoDataUniversal, INIT);

  return (
    <form action={action} className="mt-3 space-y-2">
      <input name="restaurantId" type="hidden" value={restaurantId} />
      <button className="button-primary text-sm" disabled={pending} type="submit">
        {pending ? "Generando…" : "Generar datos demo"}
      </button>
      {state.message && (
        <p className={`text-xs font-medium ${state.ok ? "text-emerald-600" : "text-red-600"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
