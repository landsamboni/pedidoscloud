import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyPaymentNumber } from "@/components/payment-instructions";
import { PaymentProofForm } from "@/components/payment-proof-form";
import { AutoRefresh } from "@/components/auto-refresh";
import { formatMoney, formatOrderNumber } from "@/lib/format";
import { getPublicOrder } from "@/lib/data";
import { resolveFileUrl } from "@/lib/file-url";

const statusLabels: Record<string, string> = {
  NEW: "Pedido recibido",
  PAYMENT_PENDING: "Pendiente de pago",
  PAYMENT_REVIEW: "Comprobante en revisión",
  PAYMENT_CONFIRMED: "¡Pago confirmado!",
  PAYMENT_REJECTED: "Revisa tu comprobante",
  CANCELLED: "Pedido cancelado",
};

const statusMessages: Record<string, string> = {
  NEW: "Tu pedido fue recibido por el restaurante.",
  PAYMENT_PENDING: "Sigue los pasos a continuación para completar tu pago.",
  PAYMENT_REVIEW: "El restaurante está revisando tu comprobante. Te avisamos aquí cuando confirmen.",
  PAYMENT_CONFIRMED: "Tu pago fue confirmado. El restaurante está preparando tu pedido.",
  PAYMENT_REJECTED: "El restaurante no pudo validar el comprobante. Puedes enviar uno nuevo.",
  CANCELLED: "Este pedido fue cancelado.",
};

function buildWhatsAppUrl(phone: string | null | undefined, restaurantName: string, orderNumber: number, message?: string) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  const waPhone = digits.startsWith("57") ? digits : `57${digits}`;
  const text = message ?? `Hola ${restaurantName}! 👋 Quisiera consultar el estado de mi pedido ${formatOrderNumber(orderNumber)}. Gracias!`;
  return `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`;
}

export default async function PublicOrderPage({ params }: { params: Promise<{ restaurantSlug: string; publicToken: string }> }) {
  const { restaurantSlug, publicToken } = await params;
  const order = await getPublicOrder(restaurantSlug, publicToken);
  if (!order) notFound();

  const canUpload = ["PAYMENT_PENDING", "PAYMENT_REJECTED", "PAYMENT_REVIEW"].includes(order.status);
  const isWaiting = order.status === "PAYMENT_REVIEW";
  const isCancelled = order.status === "CANCELLED";
  const paymentConfigured = order.restaurant.nequiAccountName && order.restaurant.nequiPhone;
  const nequiQrUrl = resolveFileUrl(order.restaurant.nequiQrPath);
  const waPhone = order.restaurant.whatsappPhone ?? order.restaurant.nequiPhone;
  const whatsAppUrl = buildWhatsAppUrl(waPhone, order.restaurant.name, order.orderNumber);
  const cancelWhatsAppUrl = buildWhatsAppUrl(
    waPhone,
    order.restaurant.name,
    order.orderNumber,
    `Hola ${order.restaurant.name}! 👋 Quisiera saber por qué fue cancelado mi pedido ${formatOrderNumber(order.orderNumber)}. Gracias.`,
  );
  const assistanceWhatsAppUrl = buildWhatsAppUrl(
    waPhone,
    order.restaurant.name,
    order.orderNumber,
    `Hola ${order.restaurant.name}! 👋 Necesito asistencia con mi pedido ${formatOrderNumber(order.orderNumber)} que ya fue confirmado. Gracias.`,
  );
  const additionalMethods = order.restaurant.paymentMethods ?? [];

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <header className="py-5">
        <p className="text-sm font-bold uppercase tracking-wide text-teal-600">{order.restaurant.name}</p>
        <h1 className="mt-1 text-3xl font-bold">Pedido {formatOrderNumber(order.orderNumber)}</h1>
      </header>

      {/* Status card */}
      <section className="card">
        <p className="text-sm font-bold uppercase tracking-wide text-stone-500">Estado actual</p>
        <h2 className="mt-2 text-2xl font-bold text-stone-900">{statusLabels[order.status]}</h2>
        <p className="mt-2 text-base leading-relaxed text-stone-600">{statusMessages[order.status]}</p>
        <AutoRefresh active={isWaiting} intervalMs={20000} />
        <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-4 text-xl font-bold">
          <span>Total a pagar</span>
          <span>{formatMoney(Number(order.total))}</span>
        </div>
      </section>

      {/* Cancelled order — prominent red section */}
      {isCancelled && (
        <section className="card mt-4 border-red-400 bg-red-50">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-500 text-2xl font-bold text-white shadow-sm">
              ✕
            </div>
            <div>
              <h2 className="text-2xl font-bold text-red-900">Pedido cancelado por el restaurante</h2>
              <p className="mt-2 text-base leading-relaxed text-red-800">
                El restaurante canceló este pedido. Si deseas puedes iniciar un nuevo pedido o
                contactar al restaurante directamente para saber el motivo.
              </p>
              {cancelWhatsAppUrl && (
                <a
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1ebe5d]"
                  href={cancelWhatsAppUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Preguntar al restaurante
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Step-by-step guide — only when payment is pending */}
      {canUpload && !isWaiting && (
        <section className="card mt-4 border-teal-200 bg-teal-50">
          <h2 className="text-lg font-bold text-teal-900">Cómo completar tu pago</h2>
          <ol className="mt-3 space-y-3">
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">1</span>
              <p className="text-base text-teal-900">Copia el número o escanea el QR de abajo.</p>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">2</span>
              <p className="text-base text-teal-900">
                Abre tu app de pagos (Nequi, Daviplata, etc.) y transfiere exactamente{" "}
                <strong>{formatMoney(Number(order.total))}</strong>.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">3</span>
              <p className="text-base text-teal-900">Regresa aquí y adjunta el comprobante de pago para que el restaurante lo verifique.</p>
            </li>
          </ol>
        </section>
      )}

      {/* Payment methods */}
      {canUpload && paymentConfigured && (
        <section className="card mt-4">
          <h2 className="text-2xl font-bold">Realiza el pago</h2>

          {/* Primary Nequi */}
          <div className="mt-4 rounded-2xl bg-purple-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-purple-500">Nequi</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <p className="text-2xl font-bold tracking-wide">{order.restaurant.nequiPhone}</p>
              <p className="text-sm text-purple-700">{order.restaurant.nequiAccountName}</p>
            </div>
            <div className="mt-3 space-y-2">
              <CopyPaymentNumber label="Copiar número Nequi" value={order.restaurant.nequiPhone!} />
              {nequiQrUrl && (
                <>
                  <div className="mx-auto max-w-xs overflow-hidden rounded-2xl border border-stone-200 bg-white p-3">
                    <Image
                      alt={`QR Nequi de ${order.restaurant.name}`}
                      className="h-auto w-full"
                      height={320}
                      src={nequiQrUrl}
                      unoptimized
                      width={320}
                    />
                  </div>
                  <a
                    className="button-secondary block w-full text-center text-base"
                    download="qr-nequi.jpg"
                    href={nequiQrUrl}
                  >
                    Guardar QR en galería
                  </a>
                  <p className="text-center text-xs text-stone-400">
                    En iPhone: abre el QR y mantén presionado para guardarlo.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Additional payment methods */}
          {additionalMethods.map((m) => (
            <div className="mt-3 rounded-2xl bg-stone-50 p-4" key={m.id}>
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500">{m.label}</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-2">
                <p className="text-2xl font-bold tracking-wide">{m.phone}</p>
                <p className="text-sm text-stone-600">{m.accountName}</p>
              </div>
              <div className="mt-3">
                <CopyPaymentNumber label={`Copiar número ${m.label}`} value={m.phone} />
              </div>
            </div>
          ))}

          <p className="mt-4 text-sm leading-relaxed text-stone-500">
            Transfiere exactamente <strong>{formatMoney(Number(order.total))}</strong> y regresa aquí para adjuntar el comprobante.
          </p>
        </section>
      )}

      {canUpload && !paymentConfigured && (
        <section className="card mt-4">
          <p className="text-base text-stone-600">Comunícate con el restaurante para recibir las instrucciones de pago.</p>
        </section>
      )}

      {/* Upload proof */}
      {canUpload && !order.paymentProofPath && (
        <section className="card mt-4">
          <h2 className="text-2xl font-bold">Adjunta tu comprobante</h2>
          <p className="mt-2 text-base leading-relaxed text-stone-600">
            Toma una foto o captura de pantalla del comprobante de pago y súbela aquí.
          </p>
          <PaymentProofForm publicToken={publicToken} restaurantSlug={restaurantSlug} />
        </section>
      )}

      {/* Proof status */}
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
              : "El restaurante recibió tu comprobante y lo revisará pronto. Esta página se actualiza automáticamente."}
          </p>
        </section>
      )}

      {/* Waiting indicator */}
      {isWaiting && order.paymentProofPath && (
        <section className="card mt-4 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-4">
            <div className="relative mt-1 flex h-10 w-10 shrink-0 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-60" />
              <span className="relative inline-flex h-6 w-6 rounded-full bg-amber-500" />
            </div>
            <div>
              <p className="text-base font-bold text-amber-900">Verificando tu pago…</p>
              <p className="mt-1 text-sm leading-relaxed text-amber-800">
                El restaurante está revisando tu comprobante. Esta página se actualiza cada 20 segundos — no la cierres.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Payment confirmed */}
      {order.status === "PAYMENT_CONFIRMED" && (
        <section className="card mt-4 border-emerald-400 bg-emerald-50">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-3xl font-bold text-white shadow-sm">✓</div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-emerald-900">¡Tu pago fue confirmado!</h2>
              <p className="mt-2 text-base leading-relaxed text-emerald-800">
                El restaurante verificó tu comprobante y está preparando tu pedido. ¡Gracias!
              </p>
              {assistanceWhatsAppUrl && (
                <a
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1ebe5d]"
                  href={assistanceWhatsAppUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Contactar al restaurante
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* WhatsApp support */}
      {isWaiting && whatsAppUrl && (
        <section className="card mt-4 border-stone-200 bg-stone-50">
          <p className="text-sm font-semibold text-stone-700">¿Sin novedades?</p>
          <p className="mt-1 text-sm leading-relaxed text-stone-500">
            Si llevas un rato esperando, puedes preguntarle directamente al restaurante.
          </p>
          <a
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1ebe5d]"
            href={whatsAppUrl}
            rel="noreferrer"
            target="_blank"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Preguntar por WhatsApp
          </a>
        </section>
      )}

      {/* Correct proof */}
      {canUpload && order.paymentProofPath && (
        <details className="card mt-4" open={order.status === "PAYMENT_REJECTED"}>
          <summary className="cursor-pointer text-base font-semibold text-stone-700">Corregir comprobante</summary>
          <p className="mt-3 text-sm leading-relaxed text-stone-600">
            Usa esta opción únicamente si seleccionaste el archivo incorrecto o el restaurante te pidió corregirlo.
          </p>
          <PaymentProofForm compact publicToken={publicToken} restaurantSlug={restaurantSlug} />
        </details>
      )}

      <section className="mt-5">
        <Link className="block rounded-xl bg-teal-600 px-4 py-3 text-center text-base font-bold text-white shadow-sm transition hover:bg-teal-700" href={`/r/${restaurantSlug}`}>
          Hacer otro pedido
        </Link>
      </section>
    </main>
  );
}
