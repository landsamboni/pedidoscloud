"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createPaymentMethod, type ActionState } from "@/app/actions";
import { FileInput, Toast } from "@/components/feedback-form";

const INITIAL: ActionState = { ok: false, message: "", ts: 0 };

/**
 * Standard "add payment method" form, consistent across all methods (wallet/key
 * or bank account), with an optional QR — same fields and look as the Nequi card.
 * A "cuenta bancaria" toggle reveals account type + cédula.
 */
export function PaymentMethodForm({ restaurantId, returnPath }: { restaurantId: string; returnPath: string }) {
  const [state, action] = useActionState(createPaymentMethod, INITIAL);
  const [isBank, setIsBank] = useState(false);
  const [toast, setToast] = useState(false);
  const lastTs = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && state.ts !== lastTs.current) {
      lastTs.current = state.ts;
      setToast(true);
      setIsBank(false);
      formRef.current?.reset();
      const t = setTimeout(() => setToast(false), 3500);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <>
      <form action={action} className="grid gap-3 sm:grid-cols-2" ref={formRef}>
        <input name="restaurantId" type="hidden" value={restaurantId} />
        <input name="returnPath" type="hidden" value={returnPath} />

        <label className="text-sm font-medium text-stone-700">
          Tipo de pago <span className="font-normal text-stone-400">(ej. Nequi, Daviplata, Bancolombia)</span>
          <input className="input mt-1" name="label" placeholder="Daviplata" required />
        </label>
        <label className="text-sm font-medium text-stone-700">
          Titular
          <input className="input mt-1" name="accountName" placeholder="Nombre del titular" required />
        </label>

        <label className="text-sm font-medium text-stone-700 sm:col-span-2">
          {isBank ? "Número de cuenta" : "Número o llave"}
          <input className="input mt-1" inputMode="tel" name="phone" placeholder={isBank ? "Número de la cuenta" : "3001234567"} required />
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-stone-700 sm:col-span-2">
          <input checked={isBank} className="h-4 w-4 accent-brand-blue" name="isBank" onChange={(e) => setIsBank(e.target.checked)} type="checkbox" />
          Es una cuenta bancaria (ahorros / corriente)
        </label>

        {isBank && (
          <>
            <label className="text-sm font-medium text-stone-700">
              Tipo de cuenta
              <select className="input mt-1" defaultValue="ahorros" name="accountType">
                <option value="ahorros">Ahorros</option>
                <option value="corriente">Corriente</option>
              </select>
            </label>
            <label className="text-sm font-medium text-stone-700">
              Cédula del titular
              <input className="input mt-1" inputMode="numeric" name="idNumber" placeholder="1234567890" required={isBank} />
            </label>
          </>
        )}

        <label className="text-sm font-medium text-stone-700 sm:col-span-2">
          QR <span className="font-normal text-stone-400">(opcional, imagen JPG/PNG/WEBP)</span>
          <FileInput accept="image/jpeg,image/png,image/webp" className="input mt-1" name="qr" type="file" />
        </label>

        {!state.ok && state.message && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 sm:col-span-2">{state.message}</p>
        )}

        <SubmitRow />
      </form>
      {toast && <Toast message={state.message} />}
    </>
  );
}

function SubmitRow() {
  const { pending } = useFormStatus();
  return (
    <button className="button-secondary sm:col-span-2" disabled={pending} type="submit">
      {pending ? "Agregando…" : "+ Agregar medio de pago"}
    </button>
  );
}
