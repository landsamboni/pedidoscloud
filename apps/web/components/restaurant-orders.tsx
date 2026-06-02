"use client";

import { useEffect, useState } from "react";
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
  createdAtMs: number;
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

const PENDING = new Set(["NEW", "PAYMENT_PENDING", "PAYMENT_REVIEW"]);

// Groups shown in the dashboard, in display order.
const GROUPS: { key: string; label: string; statuses: string[] }[] = [
  { key: "review",    label: "Revisar comprobante",  statuses: ["PAYMENT_REVIEW"] },
  { key: "pending",   label: "Pendientes de pago",   statuses: ["PAYMENT_PENDING", "NEW"] },
  { key: "rejected",  label: "Comprobante rechazado", statuses: ["PAYMENT_REJECTED"] },
  { key: "confirmed", label: "Confirmados",           statuses: ["PAYMENT_CONFIRMED"] },
  { key: "cancelled", label: "Cancelados",            statuses: ["CANCELLED"] },
];

function urgencyBorder(order: Order, now: number | null): string {
  if (!now || !PENDING.has(order.status)) return "";
  const elapsed = now - order.createdAtMs;
  if (elapsed > 3 * 60 * 1000) return "border-red-400 ring-2 ring-red-100";
  if (elapsed > 2 * 60 * 1000) return "border-orange-400 ring-2 ring-orange-100";
  if (order.status === "PAYMENT_REVIEW") return "border-purple-400 ring-2 ring-purple-100";
  return "";
}

interface Props {
  restaurantSlug: string;
  orders: Order[];
  readOnly?: boolean;
}

export function RestaurantOrders({ restaurantSlug, orders, readOnly = false }: Props) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  useEffect(() => {
    setNow(Date.now());
    if (readOnly) return;
    const refresh = window.setInterval(() => router.refresh(), 10_000);
    const tick    = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => { window.clearInterval(refresh); window.clearInterval(tick); };
  }, [router, readOnly]);

  if (!orders.length) {
    return <section className="card text-stone-600">Todavía no hay pedidos para hoy.</section>;
  }

  // Build a map for fast lookup
  const byStatus: Record<string, Order[]> = {};
  for (const o of orders) {
    (byStatus[o.status] ??= []).push(o);
  }

  const renderedGroups = GROUPS.filter((g) =>
    g.statuses.some((s) => (byStatus[s]?.length ?? 0) > 0),
  );

  return (
    <>
      <div className="space-y-8">
        {renderedGroups.map((group) => {
          const groupOrders = group.statuses.flatMap((s) => byStatus[s] ?? []);
          const isActionGroup = group.key === "review";
          return (
            <section key={group.key}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className={`text-sm font-bold uppercase tracking-wider ${isActionGroup ? "text-purple-700" : "text-stone-500"}`}>
                  {group.label}
                </h2>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isActionGroup ? "bg-purple-100 text-purple-700" : "bg-stone-100 text-stone-600"}`}>
                  {groupOrders.length}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 xl:items-start">
                {groupOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    now={now}
                    onViewProof={setProofUrl}
                    order={order}
                    readOnly={readOnly}
                    restaurantSlug={restaurantSlug}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* In-app proof viewer modal */}
      {proofUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setProofUrl(null)}
        >
          <div
            className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-5 py-4">
              <p className="font-semibold text-stone-900">Comprobante de pago</p>
              <div className="flex items-center gap-3">
                <a className="text-sm font-medium text-teal-600 hover:underline" download href={proofUrl}>
                  Descargar
                </a>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"
                  onClick={() => setProofUrl(null)}
                  type="button"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="overflow-auto p-4">
              {proofUrl.toLowerCase().includes(".pdf") ? (
                <iframe className="h-[72vh] w-full rounded-xl" src={proofUrl} title="Comprobante PDF" />
              ) : (
                <img alt="Comprobante de pago" className="h-auto w-full rounded-xl" src={proofUrl} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function OrderCard({
  order,
  restaurantSlug,
  now,
  readOnly,
  onViewProof,
}: {
  order: Order;
  restaurantSlug: string;
  now: number | null;
  readOnly: boolean;
  onViewProof: (url: string) => void;
}) {
  const border = urgencyBorder(order, now);
  return (
    <article className={`card flex flex-col gap-0 ${border}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-3xl font-black tracking-tight">{formatOrderNumber(order.orderNumber)}</p>
          <p className="mt-0.5 text-sm text-stone-400">{order.createdAtLabel}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${statusColors[order.status]}`}>
          {statusLabels[order.status]}
        </span>
      </div>

      <div className="mt-4 space-y-1.5 text-base">
        <p><span className="text-stone-500">Cliente</span> <strong>{order.customer.name}</strong></p>
        <p><span className="text-stone-500">Tel.</span> <strong>{order.customer.phone}</strong></p>
        <p className="text-stone-700"><span className="text-stone-500">Dirección</span> {order.address}</p>
        <p><span className="text-stone-500">Total</span> <strong>{order.totalLabel}</strong></p>
      </div>

      <div className="mt-4 space-y-2">
        {order.items.map((item, index) => (
          <div className="rounded-xl bg-stone-50 p-3" key={item.id}>
            {order.items.length > 1 && (
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-400">Almuerzo {index + 1}</p>
            )}
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-base">
              <dt className="text-stone-500">Sopa</dt>      <dd className="font-medium">{item.soup}</dd>
              <dt className="text-stone-500">Proteína</dt>  <dd className="font-medium">{item.protein}</dd>
              <dt className="text-stone-500">Principio</dt> <dd className="font-medium">{item.side}</dd>
              <dt className="text-stone-500">Bebida</dt>    <dd className="font-medium">{item.drink}</dd>
            </dl>
          </div>
        ))}
      </div>

      {order.paymentProofPath && (
        <div className="mt-4 rounded-xl bg-purple-50 p-3">
          <p className="text-sm font-semibold text-purple-800">
            Comprobante recibido{order.paymentSubmittedAtLabel ? ` · ${order.paymentSubmittedAtLabel}` : ""}
          </p>
          {/* Opens in-app modal instead of new tab */}
          <button
            className="button-secondary mt-2 border-purple-300 text-purple-800"
            onClick={() => onViewProof(order.paymentProofPath!)}
            type="button"
          >
            Ver comprobante
          </button>
        </div>
      )}

      {!readOnly && order.status !== "CANCELLED" && order.status !== "PAYMENT_CONFIRMED" && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-4">
          <StatusButton id={order.id} slug={restaurantSlug} status="PAYMENT_CONFIRMED">Confirmar pago</StatusButton>
          {order.paymentProofPath && order.status !== "PAYMENT_REJECTED" && (
            <StatusButton id={order.id} slug={restaurantSlug} status="PAYMENT_REJECTED" secondary>Rechazar</StatusButton>
          )}
          <StatusButton id={order.id} slug={restaurantSlug} status="CANCELLED" secondary>Cancelar</StatusButton>
        </div>
      )}
      {!readOnly && order.status === "PAYMENT_CONFIRMED" && (
        <div className="mt-4 border-t border-stone-100 pt-4">
          <StatusButton id={order.id} slug={restaurantSlug} status="CANCELLED" secondary>Cancelar pedido</StatusButton>
        </div>
      )}
    </article>
  );
}

function StatusButton({ id, slug, status, secondary, children }: {
  id: string; slug: string; status: string; secondary?: boolean; children: React.ReactNode;
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
