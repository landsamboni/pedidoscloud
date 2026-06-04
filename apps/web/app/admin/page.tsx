import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import { CreateRestaurantForm } from "@/components/create-restaurant-form";
import { getSubscriptionStatus, STATUS_COLORS, STATUS_LABELS } from "@/lib/subscription";
import { formatMoney } from "@/lib/format";
import { getAdminRestaurants } from "@/lib/data";

// Authenticated dashboard backed by the database — always render on demand.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const restaurants = await getAdminRestaurants();

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6 3xl:max-w-5xl">
      <header className="flex flex-wrap items-start justify-between gap-4 py-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">Administración</p>
          <h1 className="mt-1 text-3xl font-bold">Restaurantes</h1>
          <p className="mt-1 text-sm text-stone-500">{restaurants.length} restaurante{restaurants.length !== 1 ? "s" : ""}</p>
        </div>
        <form action={logoutAction}>
          <button className="button-danger" type="submit">Cerrar sesión</button>
        </form>
      </header>

      <details className="card">
        <summary className="cursor-pointer text-lg font-bold">+ Crear restaurante</summary>
        <div className="mt-4">
          <CreateRestaurantForm />
        </div>
      </details>

      <div className="mt-6 space-y-2">
        {restaurants.map((restaurant) => {
          const status = getSubscriptionStatus(restaurant.subscriptionEndsAt ?? null);
          const todayOrders = restaurant.orders.length;
          return (
            <Link
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:border-brand-blue/40 hover:shadow"
              href={`/admin/restaurants/${restaurant.slug}`}
              key={restaurant.id}
            >
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-stone-900">{restaurant.name}</p>
                <p className="text-sm text-stone-500">/{restaurant.slug} · {formatMoney(Number(restaurant.basePrice))}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                  {todayOrders} pedido{todayOrders !== 1 ? "s" : ""} hoy
                </span>
                {!restaurant.passwordHash && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Sin contraseña</span>
                )}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>
                <span className="text-brand-purple" aria-hidden>›</span>
              </div>
            </Link>
          );
        })}
        {restaurants.length === 0 && (
          <p className="rounded-2xl border border-stone-200 bg-white p-6 text-center text-stone-500">
            Aún no hay restaurantes. Crea el primero arriba.
          </p>
        )}
      </div>
    </main>
  );
}
