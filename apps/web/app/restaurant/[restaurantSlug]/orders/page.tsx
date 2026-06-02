import Link from "next/link";
import { notFound } from "next/navigation";
import { RestaurantOrders } from "@/components/restaurant-orders";
import { getTodayOrders } from "@/lib/data";
import { resolveFileUrl } from "@/lib/file-url";
import { formatMoney, formatTime } from "@/lib/format";

// Sort unverified orders first (need action), verified/done at the end.
const STATUS_PRIORITY: Record<string, number> = {
  PAYMENT_REVIEW: 0,   // proof submitted — restaurant must act
  PAYMENT_PENDING: 1,  // waiting for customer to pay
  NEW: 2,              // just received
  PAYMENT_REJECTED: 3, // customer must resubmit
  PAYMENT_CONFIRMED: 4,
  CANCELLED: 5,
};

export default async function RestaurantOrdersPage({ params }: { params: Promise<{ restaurantSlug: string }> }) {
  const { restaurantSlug } = await params;
  const restaurant = await getTodayOrders(restaurantSlug);
  if (!restaurant) notFound();

  const orders = restaurant.orders
    .map((order) => ({
      ...order,
      total: order.total.toString(),
      totalLabel: formatMoney(Number(order.total)),
      createdAtLabel: formatTime(order.createdAt),
      createdAtMs: order.createdAt.getTime(),
      paymentProofPath: resolveFileUrl(order.paymentProofPath),
      paymentSubmittedAtLabel: order.paymentSubmittedAt ? formatTime(order.paymentSubmittedAt) : null,
      items: order.items.map((item) => ({ ...item, price: item.price.toString() })),
    }))
    .sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status] ?? 9;
      const pb = STATUS_PRIORITY[b.status] ?? 9;
      if (pa !== pb) return pa - pb;
      return a.orderNumber - b.orderNumber;
    });

  const pending = orders.filter((o) => (STATUS_PRIORITY[o.status] ?? 9) < 4).length;

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">Pedidos de hoy</p>
          <h1 className="mt-1 text-3xl font-bold">{restaurant.name}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {pending > 0
              ? `${pending} pedido${pending > 1 ? "s" : ""} pendiente${pending > 1 ? "s" : ""} · se actualiza cada 10 s`
              : "Todo al día · se actualiza cada 10 s"}
          </p>
        </div>
        <Link className="button-secondary" href={`/restaurant/${restaurantSlug}`}>Consola</Link>
      </header>
      <RestaurantOrders restaurantSlug={restaurantSlug} orders={orders} />
    </main>
  );
}
