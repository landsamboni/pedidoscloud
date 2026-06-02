import Link from "next/link";
import { notFound } from "next/navigation";
import { RestaurantSettings } from "@/components/restaurant-settings";
import { ChangePasswordForm } from "@/components/change-password-form";
import { logoutAction } from "@/app/login/actions";
import { formatMoney, formatOrderNumber } from "@/lib/format";
import { getDaysRemaining, getSubscriptionStatus, STATUS_COLORS, STATUS_LABELS } from "@/lib/subscription";
import { getTodayOrders } from "@/lib/data";

export default async function RestaurantConsolePage({ params }: { params: Promise<{ restaurantSlug: string }> }) {
  const { restaurantSlug } = await params;
  const restaurant = await getTodayOrders(restaurantSlug);
  if (!restaurant) notFound();

  const menuRestaurant = await import("@/lib/data").then(({ getRestaurantMenu }) => getRestaurantMenu(restaurantSlug));
  const menu = menuRestaurant?.menus[0];

  const subStatus = getSubscriptionStatus(restaurant.subscriptionEndsAt ?? null);
  const daysLeft = restaurant.subscriptionEndsAt ? getDaysRemaining(restaurant.subscriptionEndsAt) : null;

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

      {/* Subscription status banner */}
      {subStatus !== "no-subscription" && subStatus !== "active" && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${
          subStatus === "expiring-soon" ? "border-amber-300 bg-amber-50 text-amber-800" :
          subStatus === "grace" ? "border-orange-400 bg-orange-50 text-orange-900" :
          "border-red-400 bg-red-50 text-red-900"
        }`}>
          {subStatus === "expiring-soon" && `⏰ Tu suscripción vence en ${daysLeft} día${daysLeft !== 1 ? "s" : ""} (${restaurant.subscriptionEndsAt!.toLocaleDateString("es-CO", { day: "numeric", month: "long" })}). Contáctanos para renovar.`}
          {subStatus === "grace" && "⚠ Tu suscripción venció hoy. Tienes 24 horas de gracia. Realiza el pago para continuar sin interrupciones."}
          {subStatus === "suspended" && "🔒 Suscripción suspendida. Contacta al administrador para reactivar."}
        </div>
      )}
      {subStatus === "no-subscription" && (
        <div className="mb-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-500">
          📋 Sin suscripción activa. Contacta al administrador para activar tu cuenta.
        </div>
      )}

      <section className="card">
        <div className="flex flex-wrap gap-3">
          <Link className="button-primary" href={`/restaurant/${restaurantSlug}/orders`}>Pedidos de hoy</Link>
          <Link className="button-secondary" href={`/restaurant/${restaurantSlug}/history`}>Historial</Link>
          <Link className="button-secondary" href={`/restaurant/${restaurantSlug}/analytics`}>Analíticas</Link>
          <Link className="button-secondary" href={`/r/${restaurantSlug}`}>Link para pedidos de clientes</Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <Summary label="Pedidos de hoy" value={String(restaurant.orders.length)} />
          <Summary label="Precio base" value={formatMoney(Number(restaurant.basePrice))} />
          <Summary label="Última orden" value={restaurant.orders.length ? formatOrderNumber(restaurant.orders.at(-1)!.orderNumber) : "Sin pedidos"} />
          <div className={`rounded-xl p-3 ${STATUS_COLORS[subStatus]}`}>
            <p className="text-sm opacity-80">Suscripción</p>
            <p className="mt-1 font-bold">{STATUS_LABELS[subStatus]}</p>
            {restaurant.subscriptionEndsAt && daysLeft !== null && (
              <p className="mt-0.5 text-xs opacity-70">
                {daysLeft > 0 ? `Renueva el ${restaurant.subscriptionEndsAt.toLocaleDateString("es-CO", { day: "numeric", month: "short" })}` : "Vencida"}
              </p>
            )}
          </div>
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
