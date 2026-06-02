"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus } from "@/app/actions";
import { formatOrderNumber } from "@/lib/format";

type Order = {
  id: string;
  orderNumber: number;
  status: string;
  total: string;
  totalLabel: string;
  address: string;
  createdAtLabel: string;
  paymentProofPath: string | null;
  paymentSubmittedAtLabel: string | null;
  customer: { name: string; phone: string };
  items: { id: string; soup: string; protein: string; side: string; drink: string }[];
};

const statusLabels: Record<string, string> = {
  NEW: "Nuevo",
  PAYMENT_PENDING: "Pago pendiente",
  PAYMENT_REVIEW: "Revisar comprobante",
  PAYMENT_CONFIRMED: "Pago confirmado",
  PAYMENT_REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
};

const statusColors: Record<string, string> = {
  NEW: "bg-sky-100 text-sky-800",
  PAYMENT_PENDING: "bg-amber-100 text-amber-800",
  PAYMENT_REVIEW: "bg-purple-100 text-purple-800",
  PAYMENT_CONFIRMED: "bg-emerald-100 text-emerald-800",
  PAYMENT_REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-stone-200 text-stone-600",
};

export function RestaurantOrders({ restaurantSlug, orders }: { restaurantSlug: string; orders: Order[] }) {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 10000);
    return () => window.clearInterval(timer);
  }, [router]);

  if (!orders.length) {
    return <section className="card text-stone-600">Todavía no hay pedidos para hoy.</section>;
  }

  return (
    // Mobile: single column. Desktop (md+): 2 columns. Large (xl+): 3 columns.
    // items-start prevents cards from stretching to match the tallest in the row.
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 xl:items-start">
      {orders.map((order) => (
        <article
          className={`card flex flex-col gap-0 ${
            order.status === "PAYMENT_REVIEW"
              ? "border-purple-400 ring-2 ring-purple-100"
              : ""
          }`}
          key={order.id}
        >
          {/* Header: order number + status badge */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-3xl font-black tracking-tight">
                {formatOrderNumber(order.orderNumber)}
              </p>
              <p className="mt-0.5 text-sm text-stone-400">{order.createdAtLabel}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${statusColors[order.status]}`}
            >
              {statusLabels[order.status]}
            </span>
          </div>

          {/* Customer info */}
          <div className="mt-4 space-y-1.5 text-base">
            <p>
              <span className="text-stone-500">Cliente</span>{" "}
              <strong>{order.customer.name}</strong>
            </p>
            <p>
              <span className="text-stone-500">Tel.</span>{" "}
              <strong>{order.customer.phone}</strong>
            </p>
            <p className="text-stone-700">
              <span className="text-stone-500">Dirección</span>{" "}
              {order.address}
            </p>
            <p>
              <span className="text-stone-500">Total</span>{" "}
              <strong>{order.totalLabel}</strong>
            </p>
          </div>

          {/* Lunch items — one ingredient per row with label */}
          <div className="mt-4 space-y-2">
            {order.items.map((item, index) => (
              <div className="rounded-xl bg-stone-50 p-3" key={item.id}>
                {order.items.length > 1 && (
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-400">
                    Almuerzo {index + 1}
                  </p>
                )}
                <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-base">
                  <dt className="text-stone-500">Sopa</dt>
                  <dd className="font-medium text-stone-900">{item.soup}</dd>
                  <dt className="text-stone-500">Proteína</dt>
                  <dd className="font-medium text-stone-900">{item.protein}</dd>
                  <dt className="text-stone-500">Principio</dt>
                  <dd className="font-medium text-stone-900">{item.side}</dd>
                  <dt className="text-stone-500">Bebida</dt>
                  <dd className="font-medium text-stone-900">{item.drink}</dd>
                </dl>
              </div>
            ))}
          </div>

          {/* Payment proof */}
          {order.paymentProofPath && (
            <div className="mt-4 rounded-xl bg-purple-50 p-3">
              <p className="text-sm font-semibold text-purple-800">
                Comprobante recibido
                {order.paymentSubmittedAtLabel ? ` · ${order.paymentSubmittedAtLabel}` : ""}
              </p>
              <a
                className="button-secondary mt-2 inline-block border-purple-300 text-purple-800"
                href={order.paymentProofPath}
                rel="noreferrer"
                target="_blank"
              >
                Ver comprobante
              </a>
            </div>
          )}

          {/* Action buttons */}
          {order.status !== "CANCELLED" && order.status !== "PAYMENT_CONFIRMED" ? (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-4">
              <StatusButton id={order.id} slug={restaurantSlug} status="PAYMENT_CONFIRMED">
                Confirmar pago
              </StatusButton>
              {order.paymentProofPath &&
                order.status !== "PAYMENT_REJECTED" && (
                  <StatusButton
                    id={order.id}
                    slug={restaurantSlug}
                    status="PAYMENT_REJECTED"
                    secondary
                  >
                    Rechazar
                  </StatusButton>
                )}
              <StatusButton id={order.id} slug={restaurantSlug} status="CANCELLED" secondary>
                Cancelar
              </StatusButton>
            </div>
          ) : order.status === "PAYMENT_CONFIRMED" ? (
            <div className="mt-4 border-t border-stone-100 pt-4">
              <StatusButton id={order.id} slug={restaurantSlug} status="CANCELLED" secondary>
                Cancelar pedido
              </StatusButton>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function StatusButton({
  id,
  slug,
  status,
  secondary,
  children,
}: {
  id: string;
  slug: string;
  status: string;
  secondary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <form action={updateOrderStatus}>
      <input name="id" type="hidden" value={id} />
      <input name="slug" type="hidden" value={slug} />
      <input name="status" type="hidden" value={status} />
      <button className={secondary ? "button-secondary" : "button-primary"}>{children}</button>
    </form>
  );
}
