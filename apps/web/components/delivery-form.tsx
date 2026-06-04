"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateDeliverySettings, type ActionState } from "@/app/actions";
import { Toast } from "@/components/feedback-form";

const INITIAL: ActionState = { ok: false, message: "", ts: 0 };

export function DeliveryForm({
  restaurantId,
  returnPath,
  deliveryMode,
  deliveryFee,
  deliveryNote,
  allowPickup,
}: {
  restaurantId: string;
  returnPath: string;
  deliveryMode: string;
  deliveryFee: number | null;
  deliveryNote: string | null;
  allowPickup: boolean;
}) {
  const [state, action] = useActionState(updateDeliverySettings, INITIAL);
  const [mode, setMode] = useState(deliveryMode);
  const [toast, setToast] = useState(false);
  const lastTs = useRef(0);

  useEffect(() => {
    if (state.ok && state.ts !== lastTs.current) {
      lastTs.current = state.ts;
      setToast(true);
      const t = setTimeout(() => setToast(false), 3500);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <>
      <form action={action} className="grid gap-3 sm:grid-cols-2">
        <input name="restaurantId" type="hidden" value={restaurantId} />
        <input name="returnPath" type="hidden" value={returnPath} />

        <label className="text-sm font-medium text-stone-700">
          Cobro del domicilio
          <select className="input mt-1" name="deliveryMode" onChange={(e) => setMode(e.target.value)} value={mode}>
            <option value="separate">Se paga aparte (al recibir / lo coordina el restaurante)</option>
            <option value="fixed">Tarifa fija</option>
            <option value="free">Gratis</option>
          </select>
        </label>

        {mode === "fixed" && (
          <label className="text-sm font-medium text-stone-700">
            Valor del domicilio
            <input className="input mt-1" defaultValue={deliveryFee ?? ""} inputMode="numeric" min="0" name="deliveryFee" placeholder="4000" required step="1" type="number" />
          </label>
        )}

        {/* No custom note for "separate" — a clear fixed message is shown to the customer. */}
        <input name="deliveryNote" type="hidden" value="" />

        <label className="flex items-center gap-2 text-sm font-medium text-stone-700 sm:col-span-2">
          <input className="h-4 w-4 accent-brand-blue" defaultChecked={allowPickup} name="allowPickup" type="checkbox" />
          Permitir <strong>Recoger en restaurante</strong> (sin costo de domicilio)
        </label>

        {!state.ok && state.message && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 sm:col-span-2">{state.message}</p>
        )}

        <DeliverySubmit />
      </form>
      {toast && <Toast message={state.message} />}
    </>
  );
}

function DeliverySubmit() {
  const { pending } = useFormStatus();
  return (
    <button className="button-primary sm:col-span-2" disabled={pending} type="submit">
      {pending ? "Guardando…" : "Guardar opciones de entrega"}
    </button>
  );
}
