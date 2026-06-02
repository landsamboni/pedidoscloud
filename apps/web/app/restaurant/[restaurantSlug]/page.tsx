import Link from "next/link";
import { notFound } from "next/navigation";
import { RestaurantSettings } from "@/components/restaurant-settings";
import { ChangePasswordForm } from "@/components/change-password-form";
import { logoutAction } from "@/app/login/actions";
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
      <header className="flex flex-wrap items-start justify-between gap-4 py-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">Consola del restaurante</p>
          <h1 className="mt-1 text-3xl font-bold">{restaurant.name}</h1>
          <p className="mt-2 text-stone-600">Administra tu menú, pagos Nequi y pedidos del día.</p>
        </div>
        <form action={logoutAction}>
          <button className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50" type="submit">
            Cerrar sesión
          </button>
        </form>
      </header>

      <section className="card">
        <div className="flex flex-wrap gap-3">
          <Link className="button-primary" href={`/restaurant/${restaurantSlug}/orders`}>Pedidos de hoy</Link>
          <Link className="button-secondary" href={`/restaurant/${restaurantSlug}/history`}>Historial</Link>
          <Link className="button-secondary" href={`/restaurant/${restaurantSlug}/analytics`}>Analíticas</Link>
          <Link className="button-secondary" href={`/r/${restaurantSlug}`}>Página del cliente</Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Summary label="Pedidos de hoy" value={String(restaurant.orders.length)} />
          <Summary label="Precio base" value={formatMoney(Number(restaurant.basePrice))} />
          <Summary label="Última orden" value={restaurant.orders.length ? formatOrderNumber(restaurant.orders.at(-1)!.orderNumber) : "Sin pedidos"} />
        </div>
      </section>

      <section className="card mt-4">
        <h2 className="mb-4 text-xl font-bold">Configuración</h2>
        <RestaurantSettings hidePassword menu={menu} restaurant={restaurant} returnPath={`/restaurant/${restaurantSlug}`} />
      </section>

      <section className="card mt-4">
        <h2 className="mb-4 text-xl font-bold">Cambiar contraseña</h2>
        <ChangePasswordForm />
      </section>
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
