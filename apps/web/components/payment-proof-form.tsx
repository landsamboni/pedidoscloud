"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { uploadPaymentProof } from "@/app/actions";
import { FileInput } from "@/components/feedback-form";

const initialState = { error: "", success: false };

export function PaymentProofForm({ compact = false, publicToken, restaurantSlug }: { compact?: boolean; publicToken: string; restaurantSlug: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(uploadPaymentProof, initialState);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <form action={action} className={compact ? "mt-3 space-y-3" : "mt-4 space-y-3"}>
      <input name="restaurantSlug" type="hidden" value={restaurantSlug} />
      <input name="publicToken" type="hidden" value={publicToken} />
      <FileInput accept="image/jpeg,image/png,image/webp,application/pdf" className="input text-base file:mr-3 file:rounded-lg file:border-0 file:bg-stone-200 file:px-3 file:py-2 file:font-semibold" maxMB={12} name="paymentProof" required type="file" />
      {state.error && <p className="text-sm font-semibold text-red-700">{state.error}</p>}
      {state.success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-base font-semibold text-emerald-800">
          Comprobante enviado correctamente. El restaurante ya puede revisarlo.
        </div>
      )}
      <button className="button-primary w-full py-3 text-base" disabled={pending}>
        {pending ? "Enviando..." : compact ? "Reemplazar comprobante anterior" : "Enviar comprobante"}
      </button>
    </form>
  );
}
