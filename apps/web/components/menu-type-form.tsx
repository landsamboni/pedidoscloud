"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateMenuType, type ActionState } from "@/app/actions";
import { Toast } from "@/components/feedback-form";

const INITIAL: ActionState = { ok: false, message: "", ts: 0 };

export function MenuTypeForm({
  restaurantId,
  returnPath,
  menuType: initialMenuType,
  orderUnitLabel: initialLabel,
  basePrice: initialBasePrice,
}: {
  restaurantId: string;
  returnPath: string;
  menuType: string;
  orderUnitLabel: string;
  basePrice: string;
}) {
  const [state, action] = useActionState(updateMenuType, INITIAL);
  const [menuType, setMenuType] = useState(initialMenuType);
  const [toast, setToast] = useState(false);
  const lastTs = useRef(0);

  useEffect(() => {
    if (state.ok && state.ts !== lastTs.current) {
      lastTs.current = state.ts;
      setToast(true);
      setTimeout(() => setToast(false), 3500);
    }
  }, [state]);

  const isCatalog = menuType === "catalog";

  return (
    <>
      <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input name="restaurantId" type="hidden" value={restaurantId} />
        <input name="returnPath" type="hidden" value={returnPath} />

        <label className="text-sm font-medium text-stone-700 sm:col-span-2">
          Modo del menú
          <select
            className="input mt-1"
            name="menuType"
            onChange={e => setMenuType(e.target.value)}
            value={menuType}
          >
            <option value="combo">Menú de combos (sopa, proteína, principio, bebida)</option>
            <option value="catalog">Catálogo libre (productos con precio individual)</option>
          </select>
        </label>

        <label className="text-sm font-medium text-stone-700">
          Nombre de cada pedido{" "}
          <span className="font-normal text-stone-400">(ej. almuerzo, pedido, caja, docena)</span>
          <input
            className="input mt-1"
            defaultValue={initialLabel}
            name="orderUnitLabel"
            placeholder="almuerzo"
            required
          />
        </label>

        {/* Always include basePrice but hide/zero it in catalog mode so the
            form submits cleanly without a required-but-hidden field. */}
        <label className={`text-sm font-medium text-stone-700 ${isCatalog ? "hidden" : ""}`}>
          Precio base
          <input
            className="input mt-1 text-base"
            defaultValue={initialBasePrice}
            min="0"
            name="basePrice"
            step="1"
            type="number"
          />
        </label>

        {!state.ok && state.message && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 sm:col-span-2">
            {state.message}
          </p>
        )}

        <SaveButton />
      </form>
      {toast && <Toast message={state.message} />}
    </>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button-primary sm:col-span-2" disabled={pending} type="submit">
      {pending ? "Guardando…" : "Guardar configuración"}
    </button>
  );
}
