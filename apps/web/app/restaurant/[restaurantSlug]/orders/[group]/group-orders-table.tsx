"use client";

import { useEffect, useState, useTransition } from "react";
import { updateOrderStatus } from "@/app/actions";
import { formatMoney, formatOrderNumber } from "@/lib/format";
import { parseItemName } from "@/lib/menu";
import { resolveFileUrl } from "@/lib/file-url";

type Order = {
  id: string;
  orderNumber: number;
  status: string;
  createdAtLabel: string;
  createdAtMs: number;
  totalLabel: string;
  deliveryFee: number;
  fulfillment: string;
  address: string;
  paymentProofPath: string | null;
  paymentSubmittedAtLabel: string | null;
  customer: { name: string; phone: string; favorite?: boolean };
  items: { id: string; soup: string; protein: string; side: string; drink: string; catalogCategory: string; catalogItem: string; quantity: number; unitPrice: string }[];
};

function relativeTime(createdAtMs: number, now: number): string {
  const mins = Math.floor((now - createdAtMs) / 60000);
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function ItemsSummary({ items }: { items: Order["items"] }) {
  if (items[0]?.catalogItem) {
    return (
      <div className="space-y-0.5">
        {items.map((i) => (
          <p key={i.id} className="text-sm">
            <span className="font-semibold">{i.quantity}×</span> {i.catalogItem}
          </p>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-1">
      {items.map((item, idx) => (
        <div key={item.id} className="text-sm">
          {items.length > 1 && <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Almuerzo {idx + 1}</p>}
          <p>{parseItemName(item.soup)} · {parseItemName(item.protein)}</p>
          <p className="text-stone-500">{parseItemName(item.side)} · {parseItemName(item.drink)}</p>
        </div>
      ))}
    </div>
  );
}

function ActionCell({ order, restaurantSlug }: { order: Order; restaurantSlug: string }) {
  const [pending, startTransition] = useTransition();

  function changeStatus(status: string) {
    const fd = new FormData();
    fd.append("id", order.id);
    fd.append("slug", restaurantSlug);
    fd.append("status", status);
    startTransition(() => updateOrderStatus(fd));
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-[140px]">
      {order.status !== "PAYMENT_CONFIRMED" && order.status !== "CANCELLED" && (
        <button
          className="button-primary text-sm py-1.5 disabled:opacity-50"
          disabled={pending}
          onClick={() => changeStatus("PAYMENT_CONFIRMED")}
          type="button"
        >
          {order.status === "PAYMENT_REVIEW" ? "Confirmar pago" : "Confirmar"}
        </button>
      )}
      {order.status === "PAYMENT_CONFIRMED" && (
        <button
          className="button-secondary text-sm py-1.5"
          disabled={pending}
          onClick={() => changeStatus(order.paymentProofPath ? "PAYMENT_REVIEW" : "PAYMENT_PENDING")}
          type="button"
        >
          ↩ Reactivar
        </button>
      )}
      {order.status === "PAYMENT_REJECTED" && (
        <button
          className="button-secondary text-sm py-1.5"
          disabled={pending}
          onClick={() => changeStatus("PAYMENT_REVIEW")}
          type="button"
        >
          ↩ Reactivar
        </button>
      )}
      {order.status !== "CANCELLED" && order.status !== "PAYMENT_CONFIRMED" && (
        <button
          className="button-secondary text-sm py-1.5 text-red-600 border-red-200 hover:bg-red-50"
          disabled={pending}
          onClick={() => changeStatus("CANCELLED")}
          type="button"
        >
          Cancelar
        </button>
      )}
      {order.status === "CANCELLED" && (
        <button
          className="button-secondary text-sm py-1.5"
          disabled={pending}
          onClick={() => changeStatus("PAYMENT_PENDING")}
          type="button"
        >
          ↩ Reactivar
        </button>
      )}
    </div>
  );
}

export function GroupOrdersTable({ orders, restaurantSlug }: { orders: Order[]; restaurantSlug: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs font-bold uppercase tracking-wide text-stone-500">
            <th className="px-4 py-3 w-20">#Orden</th>
            <th className="px-4 py-3 w-32">Hora</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3 w-36">Teléfono</th>
            <th className="px-4 py-3">Dirección</th>
            <th className="px-4 py-3">Pedido</th>
            <th className="px-4 py-3 w-28 text-right">Total</th>
            <th className="px-4 py-3 w-10 text-center">Comp.</th>
            <th className="px-4 py-3 w-40">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order, i) => (
            <tr
              key={order.id}
              className={`border-b border-stone-100 transition hover:bg-stone-50 ${i % 2 === 0 ? "" : "bg-stone-50/50"}`}
            >
              {/* Order number */}
              <td className="px-4 py-3">
                <span className="text-xl font-black tracking-tight">{formatOrderNumber(order.orderNumber)}</span>
              </td>

              {/* Time + relative */}
              <td className="px-4 py-3">
                <p className="font-medium text-stone-700">{order.createdAtLabel}</p>
                {now && (
                  <p className="text-xs text-stone-400">{relativeTime(order.createdAtMs, now)}</p>
                )}
              </td>

              {/* Customer */}
              <td className="px-4 py-3">
                <p className="font-semibold text-stone-900">
                  {order.customer.name}
                  {order.customer.favorite && <span className="ml-1 text-xs">⭐</span>}
                </p>
              </td>

              {/* Phone */}
              <td className="px-4 py-3">
                <a
                  className="font-mono text-sm font-semibold text-stone-700 hover:text-brand-blue"
                  href={`https://wa.me/57${order.customer.phone}?text=${encodeURIComponent(`Hola! Te contactamos sobre tu pedido ${formatOrderNumber(order.orderNumber)}.`)}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  {order.customer.phone}
                </a>
              </td>

              {/* Address */}
              <td className="px-4 py-3 text-stone-600 max-w-[200px]">
                {order.fulfillment === "pickup"
                  ? <span className="font-semibold text-brand-purple text-xs">🏪 Recoge</span>
                  : order.address}
              </td>

              {/* Items */}
              <td className="px-4 py-3">
                <ItemsSummary items={order.items} />
              </td>

              {/* Total */}
              <td className="px-4 py-3 text-right">
                <p className="font-bold text-stone-900">{order.totalLabel}</p>
                {order.deliveryFee > 0 && (
                  <p className="text-xs text-stone-400">+{formatMoney(order.deliveryFee)} dom.</p>
                )}
              </td>

              {/* Proof */}
              <td className="px-4 py-3 text-center">
                {order.paymentProofPath ? (
                  <a
                    className="text-lg"
                    href={order.paymentProofPath}
                    rel="noreferrer"
                    target="_blank"
                    title={`Comprobante recibido${order.paymentSubmittedAtLabel ? ` · ${order.paymentSubmittedAtLabel}` : ""}`}
                  >
                    📎
                  </a>
                ) : (
                  <span className="text-stone-300">—</span>
                )}
              </td>

              {/* Actions */}
              <td className="px-4 py-3">
                <ActionCell order={order} restaurantSlug={restaurantSlug} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
