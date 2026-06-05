import { deletePaymentMethod, updatePaymentSettings } from "@/app/actions";
import { DeliveryForm } from "@/components/delivery-form";
import { FeedbackForm, FileInput, SubmitButton } from "@/components/feedback-form";
import { PaymentMethodForm } from "@/components/payment-method-form";
import { resolveFileUrl } from "@/lib/file-url";

type PaymentMethod = {
  id: string;
  label: string;
  phone: string;
  accountName: string;
  qrPath: string | null;
  accountType: string | null;
  idNumber: string | null;
};

type DeliveryProps = {
  restaurantId: string;
  returnPath: string;
  deliveryMode: string;
  deliveryFee: { toString(): string } | null;
  deliveryNote: string | null;
  allowPickup: boolean;
};

type PaymentProps = {
  restaurantId: string;
  returnPath: string;
  nequiPhone: string | null;
  nequiAccountName: string | null;
  nequiQrPath: string | null;
  paymentMethods: PaymentMethod[];
};

/** Standalone collapsible card for delivery settings. */
export function DeliveryCard({ restaurantId, returnPath, deliveryMode, deliveryFee, deliveryNote, allowPickup }: DeliveryProps) {
  return (
    <details className="card mt-4">
      <summary className="cursor-pointer text-xl font-bold">Domicilio y entrega</summary>
      <div className="mt-4">
        <DeliveryForm
          allowPickup={allowPickup}
          deliveryFee={deliveryFee ? Number(deliveryFee.toString()) : null}
          deliveryMode={deliveryMode}
          deliveryNote={deliveryNote}
          restaurantId={restaurantId}
          returnPath={returnPath}
        />
      </div>
    </details>
  );
}

/** Standalone collapsible card for payment methods. */
export function PaymentCard({ restaurantId, returnPath, nequiPhone, nequiAccountName, nequiQrPath, paymentMethods }: PaymentProps) {
  return (
    <details className="card mt-4">
      <summary className="cursor-pointer text-xl font-bold">Medios de pago</summary>
      <p className="mt-1 text-sm text-stone-500">Datos que verá el cliente para pagar y subir su comprobante.</p>

      {/* Nequi */}
      <FeedbackForm action={updatePaymentSettings} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input name="restaurantId" type="hidden" value={restaurantId} />
        <input name="returnPath" type="hidden" value={returnPath} />
        <p className="text-sm font-semibold text-stone-700 sm:col-span-2">Nequi (principal)</p>
        <label className="text-sm font-medium text-stone-700">
          Celular o llave Nequi
          <input className="input mt-1" defaultValue={nequiPhone ?? ""} name="nequiPhone" placeholder="3001234567" required />
        </label>
        <label className="text-sm font-medium text-stone-700">
          Nombre del titular
          <input className="input mt-1" defaultValue={nequiAccountName ?? ""} name="nequiAccountName" placeholder="Nombre o negocio" required />
        </label>
        <label className="text-sm font-medium text-stone-700 sm:col-span-2">
          QR Nequi <span className="font-normal text-stone-400">(opcional, deja vacío para conservar el actual)</span>
          <FileInput accept="image/jpeg,image/png,image/webp" className="input mt-1" name="nequiQr" type="file" />
        </label>
        {nequiQrPath && (
          <div className="flex items-center gap-3 sm:col-span-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="QR de Nequi" className="h-28 w-28 rounded-lg border border-stone-200 object-contain" src={resolveFileUrl(nequiQrPath) ?? ""} />
            <p className="text-sm text-teal-600">QR configurado. Sube otro para reemplazarlo.</p>
          </div>
        )}
        <SubmitButton className="button-primary sm:col-span-2">Guardar Nequi</SubmitButton>
      </FeedbackForm>

      {/* Otros medios */}
      <div className="mt-6 border-t border-stone-100 pt-4">
        <p className="text-sm font-semibold text-stone-700">
          Otros medios <span className="font-normal text-stone-400">(Daviplata, segunda llave, cuenta bancaria…)</span>
        </p>
        {paymentMethods.length > 0 && (
          <ul className="mt-3 space-y-2">
            {paymentMethods.map((m) => (
              <li className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3" key={m.id}>
                <div className="flex min-w-0 items-center gap-3">
                  {m.qrPath && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={`QR ${m.label}`} className="h-14 w-14 shrink-0 rounded-lg border border-stone-200 object-contain" src={resolveFileUrl(m.qrPath) ?? ""} />
                  )}
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold">{m.label}{m.accountType ? ` · cuenta ${m.accountType}` : ""}</p>
                    <p className="truncate text-stone-600">{m.phone} · {m.accountName}{m.idNumber ? ` · C.C. ${m.idNumber}` : ""}</p>
                  </div>
                </div>
                <FeedbackForm action={deletePaymentMethod}>
                  <input name="id" type="hidden" value={m.id} />
                  <input name="restaurantId" type="hidden" value={restaurantId} />
                  <input name="returnPath" type="hidden" value={returnPath} />
                  <SubmitButton className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50" pendingLabel="Eliminando…">
                    Eliminar
                  </SubmitButton>
                </FeedbackForm>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <PaymentMethodForm restaurantId={restaurantId} returnPath={returnPath} />
        </div>
      </div>
    </details>
  );
}
