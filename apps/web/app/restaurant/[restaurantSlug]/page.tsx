import Link from "next/link";
import { notFound } from "next/navigation";
import { RestaurantSettings } from "@/components/restaurant-settings";
import { formatMoney, formatOrderNumber } from "@/lib/format";
import { getTodayOrders } from "@/lib/data";

export default async function RestaurantConsolePage({ params }: { params: Promise<{ restaurantSlug: string }> }) {
  const { restaurantSlug } = await params;
  const restaurant = await getTodayOrders(restaurantSlug);
  if (!restaurant) notFound();

  const menuRestaurant = await import("@/lib/data").then(({ getRestaurantMenu }) => getRestaurantMenu(restaurantSlug));
  const menu = menuRestaurant?.menus[0];

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <header className="py-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-violet-700">Consola del restaurante</p>
        <h1 className="mt-1 text-3xl font-bold">{restaurant.name}</h1>
        <p className="mt-2 text-stone-600">Administra tu menú, pagos Nequi y pedidos del día.</p>
      </header>

      <section className="card">
        <div className="flex flex-wrap gap-3">
          <Link className="button-primary" href={`/restaurant/${restaurantSlug}/orders`}>Ver pedidos de hoy</Link>
          <Link className="button-secondary" href={`/r/${restaurantSlug}`}>Abrir página del cliente</Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Summary label="Pedidos de hoy" value={String(restaurant.orders.length)} />
          <Summary label="Precio base" value={formatMoney(Number(restaurant.basePrice))} />
          <Summary label="Última orden" value={restaurant.orders.length ? formatOrderNumber(restaurant.orders.at(-1)!.orderNumber) : "Sin pedidos"} />
        </div>
      </section>

      <section className="card mt-4">
        <h2 className="mb-4 text-xl font-bold">Configuración diaria</h2>
        <RestaurantSettings menu={menu} restaurant={restaurant} returnPath={`/restaurant/${restaurantSlug}`} />
      </section>

      <p className="mt-4 text-sm text-stone-500">
        Demo local sin login: esta consola está separada por restaurante, pero requiere autenticación antes de publicarse en internet.
      </p>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-50 p-3">
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
