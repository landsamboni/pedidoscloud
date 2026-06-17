import Link from "next/link";
import { notFound } from "next/navigation";
import { cleanupStaleOrders, getTodayOrders } from "@/lib/data";
import { resolveFileUrl } from "@/lib/file-url";
import { formatMoney, formatOrderNumber, formatTime } from "@/lib/format";
import { GroupOrdersGrid } from "./group-orders-grid";

const GROUPS: Record<string, { label: string; statuses: string[]; accent: string }> = {
  review:    { label: "Revisar comprobante",  statuses: ["PAYMENT_REVIEW"],         accent: "text-purple-700 bg-purple-100 border-purple-300" },
  pending:   { label: "Pendientes de pago",   statuses: ["PAYMENT_PENDING", "NEW"], accent: "text-amber-700 bg-amber-100 border-amber-300" },
  rejected:  { label: "Rechazados",           statuses: ["PAYMENT_REJECTED"],       accent: "text-red-700 bg-red-100 border-red-300" },
  confirmed: { label: "Confirmados",          statuses: ["PAYMENT_CONFIRMED"],      accent: "text-emerald-700 bg-emerald-100 border-emerald-300" },
  cancelled: { label: "Cancelados",           statuses: ["CANCELLED"],              accent: "text-stone-600 bg-stone-100 border-stone-300" },
};

export default async function GroupOrdersPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string; group: string }>;
}) {
  const { restaurantSlug, group } = await params;
  const groupConfig = GROUPS[group];
  if (!groupConfig) notFound();

  const restaurant = await getTodayOrders(restaurantSlug);
  if (!restaurant) notFound();

  await cleanupStaleOrders(restaurant.id);

  const orders = restaurant.orders
    .filter((o) => groupConfig.statuses.includes(o.status))
    .map((order) => ({
      ...order,
      total: order.total.toString(),
      totalLabel: formatMoney(Number(order.total)),
      deliveryFee: Number(order.deliveryFee),
      createdAtLabel: formatTime(order.createdAt),
      createdAtMs: order.createdAt.getTime(),
      paymentProofPath: resolveFileUrl(order.paymentProofPath),
      paymentSubmittedAtLabel: order.paymentSubmittedAt ? formatTime(order.paymentSubmittedAt) : null,
      items: order.items.map((item) => ({
        ...item,
        price: item.price.toString(),
        unitPrice: item.unitPrice.toString(),
      })),
      customer: {
        ...order.customer,
        name: order.customerName,
        favorite: order.customer.favorite,
      },
    }))
    .sort((a, b) => a.orderNumber - b.orderNumber);

  return (
    <main className="p-4 sm:p-6 lg:p-6 max-w-none">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            className="text-sm font-semibold text-brand-blue hover:underline"
            href={`/restaurant/${restaurantSlug}/orders`}
          >
            ← Tablero
          </Link>
          <span className={`rounded-full border px-3 py-1 text-sm font-bold ${groupConfig.accent}`}>
            {groupConfig.label} · {orders.length}
          </span>
        </div>
        <p className="text-xs text-stone-400">Pedidos de hoy · se actualiza al recargar</p>
      </header>

      {orders.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-stone-200 px-6 py-12 text-center text-stone-400">
          No hay pedidos en esta categoría hoy.
        </div>
      ) : (
        <GroupOrdersGrid
          orders={orders}
          restaurantName={restaurant.name}
          restaurantSlug={restaurantSlug}
        />
      )}
    </main>
  );
}
