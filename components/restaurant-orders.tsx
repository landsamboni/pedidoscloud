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
  PAYMENT_REJECTED: "Comprobante rechazado",
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
    <div className="space-y-4">
      {orders.map((order) => (
        <article className={`card ${order.status === "PAYMENT_REVIEW" ? "border-purple-300 ring-2 ring-purple-100" : ""}`} key={order.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-2xl font-bold">{formatOrderNumber(order.orderNumber)}</p>
              <p className="text-sm text-stone-500">{order.createdAtLabel}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColors[order.status]}`}>
              {statusLabels[order.status]}
            </span>
          </div>

          <div className="mt-4 grid gap-1 text-sm sm:grid-cols-2">
            <p><strong>Cliente:</strong> {order.customer.name}</p>
            <p><strong>Teléfono:</strong> {order.customer.phone}</p>
            <p className="sm:col-span-2"><strong>Dirección:</strong> {order.address}</p>
            <p><strong>Total:</strong> {order.totalLabel}</p>
          </div>

          <div className="mt-4 space-y-2">
            {order.items.map((item, index) => (
              <div className="rounded-xl bg-stone-50 p-3 text-sm" key={item.id}>
                <strong>Almuerzo {index + 1}:</strong> {item.soup}, {item.protein}, {item.side}, {item.drink}
              </div>
            ))}
          </div>

          {order.paymentProofPath && (
            <div className="mt-4 rounded-xl bg-purple-50 p-3">
              <p className="text-sm font-semibold text-purple-800">
                Comprobante recibido{order.paymentSubmittedAtLabel ? ` · ${order.paymentSubmittedAtLabel}` : ""}
              </p>
              <a className="button-secondary mt-3 inline-block border-purple-300 text-purple-800" href={order.paymentProofPath} rel="noreferrer" target="_blank">
                Ver comprobante
              </a>
            </div>
          )}

          {order.status !== "CANCELLED" && (
            <div className="mt-4 flex flex-wrap gap-2">
              {order.status !== "PAYMENT_CONFIRMED" && (
                <StatusButton id={order.id} slug={restaurantSlug} status="PAYMENT_CONFIRMED">
                  Confirmar pago
                </StatusButton>
              )}
              {order.paymentProofPath && order.status !== "PAYMENT_REJECTED" && order.status !== "PAYMENT_CONFIRMED" && (
                <StatusButton id={order.id} slug={restaurantSlug} status="PAYMENT_REJECTED" secondary>
                  Rechazar comprobante
                </StatusButton>
              )}
              <StatusButton id={order.id} slug={restaurantSlug} status="CANCELLED" secondary>
                Cancelar pedido
              </StatusButton>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function StatusButton({ id, slug, status, secondary, children }: { id: string; slug: string; status: string; secondary?: boolean; children: React.ReactNode }) {
  return (
    <form action={updateOrderStatus}>
      <input name="id" type="hidden" value={id} />
      <input name="slug" type="hidden" value={slug} />
      <input name="status" type="hidden" value={status} />
      <button className={secondary ? "button-secondary" : "button-primary"}>{children}</button>
    </form>
  );
}
