import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyPaymentNumber } from "@/components/payment-instructions";
import { PaymentProofForm } from "@/components/payment-proof-form";
import { formatMoney, formatOrderNumber } from "@/lib/format";
import { getPublicOrder } from "@/lib/data";
import { resolveFileUrl } from "@/lib/file-url";

const statusLabels: Record<string, string> = {
  NEW: "Pedido recibido",
  PAYMENT_PENDING: "Pendiente de pago",
  PAYMENT_REVIEW: "Comprobante en revisión",
  PAYMENT_CONFIRMED: "Pago confirmado",
  PAYMENT_REJECTED: "Revisa tu comprobante",
  CANCELLED: "Pedido cancelado",
};

const statusMessages: Record<string, string> = {
  NEW: "Tu pedido fue recibido por el restaurante.",
  PAYMENT_PENDING: "Realiza el pago y envía tu comprobante.",
  PAYMENT_REVIEW: "El restaurante está revisando tu comprobante.",
  PAYMENT_CONFIRMED: "Tu pago fue confirmado. El restaurante continuará con tu pedido.",
  PAYMENT_REJECTED: "El restaurante no pudo validar el comprobante. Puedes enviar uno nuevo.",
  CANCELLED: "Este pedido fue cancelado.",
};

export default async function PublicOrderPage({ params }: { params: Promise<{ restaurantSlug: string; publicToken: string }> }) {
  const { restaurantSlug, publicToken } = await params;
  const order = await getPublicOrder(restaurantSlug, publicToken);
  if (!order) notFound();

  const canUpload = ["PAYMENT_PENDING", "PAYMENT_REJECTED", "PAYMENT_REVIEW"].includes(order.status);
  const paymentConfigured = order.restaurant.nequiAccountName && order.restaurant.nequiPhone;
  const nequiQrUrl = resolveFileUrl(order.restaurant.nequiQrPath);

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <header className="py-5">
        <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">{order.restaurant.name}</p>
        <h1 className="mt-1 text-3xl font-bold">Pedido {formatOrderNumber(order.orderNumber)}</h1>
      </header>

      <section className="card">
        <p className="text-sm font-bold uppercase tracking-wide text-stone-500">Estado actual</p>
        <h2 className="mt-2 text-2xl font-bold text-emerald-800">{statusLabels[order.status]}</h2>
        <p className="mt-2 text-base leading-relaxed text-stone-600">{statusMessages[order.status]}</p>
        <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-4 text-xl font-bold">
          <span>Total</span>
          <span>{formatMoney(Number(order.total))}</span>
        </div>
      </section>

      {canUpload && (
        <section className="card mt-4">
          <h2 className="text-2xl font-bold">Paga por Nequi</h2>
          {paymentConfigured ? (
            <>
              {nequiQrUrl && (
                <div className="mx-auto mt-4 max-w-xs overflow-hidden rounded-2xl border border-stone-200 bg-white p-3">
                  <Image alt={`QR Nequi de ${order.restaurant.name}`} className="h-auto w-full" height={320} src={nequiQrUrl} width={320} unoptimized />
                </div>
              )}
              <div className="mt-4 rounded-2xl bg-purple-50 p-4 text-base">
                <p className="text-sm font-semibold uppercase tracking-wide text-purple-700">Celular o llave Nequi</p>
                <p className="mt-1 text-2xl font-bold tracking-wide">{order.restaurant.nequiPhone}</p>
                <p className="mt-2"><strong>Titular:</strong> {order.restaurant.nequiAccountName}</p>
              </div>
              <div className="mt-3">
                <CopyPaymentNumber value={order.restaurant.nequiPhone!} />
              </div>
              <p className="mt-4 text-base leading-relaxed text-stone-600">
                Paga exactamente <strong>{formatMoney(Number(order.total))}</strong>. Si usas el QR desde este celular, guarda la imagen y selecciónala desde la galería en tu app bancaria.
              </p>
            </>
          ) : (
            <p className="mt-3 text-base text-stone-600">Comunícate con el restaurante para recibir las instrucciones de pago.</p>
          )}
        </section>
      )}

      {canUpload && !order.paymentProofPath && (
        <section className="card mt-4">
          <h2 className="text-2xl font-bold">Envía tu comprobante</h2>
          <p className="mt-2 text-base leading-relaxed text-stone-600">Toma una foto o elige una captura de pantalla. También puedes adjuntar un PDF.</p>
          <PaymentProofForm publicToken={publicToken} restaurantSlug={restaurantSlug} />
        </section>
      )}

      {canUpload && order.paymentProofPath && (
        <section className={`card mt-4 ${order.status === "PAYMENT_REJECTED" ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
          <div className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl font-bold text-white ${order.status === "PAYMENT_REJECTED" ? "bg-amber-600" : "bg-emerald-700"}`}>
            {order.status === "PAYMENT_REJECTED" ? "!" : "✓"}
          </div>
          <h2 className={`mt-4 text-2xl font-bold ${order.status === "PAYMENT_REJECTED" ? "text-amber-950" : "text-emerald-900"}`}>
            {order.status === "PAYMENT_REJECTED" ? "Debes corregir tu comprobante" : "Comprobante enviado correctamente"}
          </h2>
          <p className={`mt-2 text-base leading-relaxed ${order.status === "PAYMENT_REJECTED" ? "text-amber-950" : "text-emerald-900"}`}>
            {order.status === "PAYMENT_REJECTED"
              ? "El restaurante no pudo validar el archivo anterior. Reemplázalo por el comprobante correcto."
              : "El restaurante recibió tu comprobante y lo revisará pronto. Tu pedido permanece en seguimiento en esta página."}
          </p>
        </section>
      )}

      {canUpload && order.paymentProofPath && (
        <details className="card mt-4" open={order.status === "PAYMENT_REJECTED"}>
          <summary className="cursor-pointer text-base font-semibold text-stone-700">Corregir comprobante</summary>
          <p className="mt-3 text-sm leading-relaxed text-stone-600">
            Usa esta opción únicamente si seleccionaste el archivo incorrecto o el restaurante te pidió corregirlo. El nuevo archivo reemplazará el comprobante anterior.
          </p>
          <PaymentProofForm compact publicToken={publicToken} restaurantSlug={restaurantSlug} />
        </details>
      )}

      <section className="mt-5">
        <Link className="block rounded-xl bg-amber-500 px-4 py-3 text-center text-base font-bold text-stone-950 shadow-sm transition hover:bg-amber-400" href={`/r/${restaurantSlug}`}>
          Hacer otro pedido
        </Link>
      </section>
    </main>
  );
}
