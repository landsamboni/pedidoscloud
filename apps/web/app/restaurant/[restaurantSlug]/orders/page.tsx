import Link from "next/link";
import { notFound } from "next/navigation";
import { RestaurantOrders } from "@/components/restaurant-orders";
import { getTodayOrders } from "@/lib/data";
import { resolveFileUrl } from "@/lib/file-url";
import { formatMoney, formatTime } from "@/lib/format";

export default async function RestaurantOrdersPage({ params }: { params: Promise<{ restaurantSlug: string }> }) {
  const { restaurantSlug } = await params;
  const restaurant = await getTodayOrders(restaurantSlug);
  if (!restaurant) notFound();

  const orders = restaurant.orders.map((order) => ({
    ...order,
    total: order.total.toString(),
    totalLabel: formatMoney(Number(order.total)),
    createdAtLabel: formatTime(order.createdAt),
    paymentProofPath: resolveFileUrl(order.paymentProofPath),
    paymentSubmittedAtLabel: order.paymentSubmittedAt ? formatTime(order.paymentSubmittedAt) : null,
    items: order.items.map((item) => ({ ...item, price: item.price.toString() })),
  }));

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-violet-700">Pedidos de hoy</p>
          <h1 className="mt-1 text-3xl font-bold">{restaurant.name}</h1>
          <p className="mt-1 text-sm text-stone-500">Se actualiza automáticamente cada 10 segundos.</p>
        </div>
        <Link className="button-secondary" href={`/restaurant/${restaurantSlug}`}>Consola</Link>
      </header>
      <RestaurantOrders restaurantSlug={restaurantSlug} orders={orders} />
    </main>
  );
}
