import Link from "next/link";
import { notFound } from "next/navigation";
import { RestaurantOrders } from "@/components/restaurant-orders";
import { getOrdersByDate } from "@/lib/data";
import { resolveFileUrl } from "@/lib/file-url";
import { formatDateKey, formatMoney, formatTime } from "@/lib/format";

export default async function HistoryDatePage({
  params,
}: {
  params: Promise<{ restaurantSlug: string; date: string }>;
}) {
  const { restaurantSlug, date } = await params;

  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const restaurant = await getOrdersByDate(restaurantSlug, date);
  if (!restaurant) notFound();

  const orders = restaurant.orders.map((order) => ({
    ...order,
    total: order.total.toString(),
    totalLabel: formatMoney(Number(order.total)),
    deliveryFee: Number(order.deliveryFee),
    createdAtLabel: formatTime(order.createdAt),
    createdAtMs: order.createdAt.getTime(),
    paymentProofPath: resolveFileUrl(order.paymentProofPath),
    paymentSubmittedAtLabel: order.paymentSubmittedAt ? formatTime(order.paymentSubmittedAt) : null,
    items: order.items.map((item) => ({ ...item, price: item.price.toString(), unitPrice: item.unitPrice.toString() })),
    customer: { ...order.customer, name: order.customerName },
  }));

  const confirmed = orders.filter((o) => o.status === "PAYMENT_CONFIRMED");
  const totalConfirmed = confirmed.reduce((acc, o) => acc + Number(o.total), 0);

  return (
    <main className="mx-auto max-w-[2400px] p-4 sm:p-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">
            Historial · {restaurant.name}
          </p>
          <h1 className="mt-1 text-3xl font-bold capitalize">{formatDateKey(date)}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {orders.length} {orders.length === 1 ? "pedido" : "pedidos"} ·{" "}
            {confirmed.length} confirmados · {formatMoney(totalConfirmed)} facturados
          </p>
        </div>
        <Link className="button-secondary" href={`/restaurant/${restaurantSlug}/history`}>Historial</Link>
      </header>

      {orders.length === 0 ? (
        <section className="card text-stone-600">No hay pedidos registrados para este día.</section>
      ) : (
        <RestaurantOrders orders={orders} readOnly restaurantSlug={restaurantSlug} />
      )}
    </main>
  );
}
