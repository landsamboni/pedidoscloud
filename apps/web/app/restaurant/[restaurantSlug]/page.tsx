import Link from "next/link";
import { notFound } from "next/navigation";
import { RestaurantSettings } from "@/components/restaurant-settings";
import { BusinessDataForm } from "@/components/business-data-form";
import { ChangePasswordForm } from "@/components/change-password-form";
import { logoutAction } from "@/app/login/actions";
import { formatMoney, formatOrderNumber } from "@/lib/format";
import { getDaysRemaining, getSubscriptionStatus, STATUS_COLORS, STATUS_LABELS } from "@/lib/subscription";
import { getMenuForEditor, getTodayOrders } from "@/lib/data";

export default async function RestaurantConsolePage({ params }: { params: Promise<{ restaurantSlug: string }> }) {
  const { restaurantSlug } = await params;
  const restaurant = await getTodayOrders(restaurantSlug);
  if (!restaurant) notFound();

  const { menu, publishedToday } = await getMenuForEditor(restaurant.id);

  const subStatus = getSubscriptionStatus(restaurant.subscriptionEndsAt ?? null);
  const daysLeft = restaurant.subscriptionEndsAt ? getDaysRemaining(restaurant.subscriptionEndsAt) : null;

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6 2xl:max-w-6xl 3xl:max-w-7xl">
      <header className="flex flex-wrap items-start justify-between gap-4 py-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">Consola del restaurante</p>
          <h1 className="mt-1 text-3xl font-bold">{restaurant.name}</h1>
          <p className="mt-2 text-stone-600">Administra tu menú, pagos Nequi y pedidos del día.</p>
        </div>
        <form action={logoutAction}>
          <button className="button-danger" type="submit">
            Cerrar sesión
          </button>
        </form>
      </header>

      {/* Subscription status banner */}
      {subStatus !== "no-subscription" && subStatus !== "active" && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${
          subStatus === "expiring-soon" ? "border-amber-300 bg-amber-50 text-amber-800" :
          "border-red-400 bg-red-50 text-red-900"
        }`}>
          {subStatus === "expiring-soon" && `⏰ Tu suscripción vence en ${daysLeft} día${daysLeft !== 1 ? "s" : ""} (${restaurant.subscriptionEndsAt!.toLocaleDateString("es-CO", { day: "numeric", month: "long" })}). Contáctanos para renovar.`}
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
          <Link className="button-secondary" href={`/r/${restaurantSlug}`} rel="noreferrer" target="_blank">Link para pedidos de clientes ↗</Link>
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
        <RestaurantSettings hidePassword menu={menu} menuPublishedToday={publishedToday} restaurant={restaurant} restaurantSlug={restaurantSlug} returnPath={`/restaurant/${restaurantSlug}`} />
      </section>

      <BusinessDataForm logoPath={restaurant.logoPath} restaurantId={restaurant.id} returnPath={`/restaurant/${restaurantSlug}`} whatsappPhone={restaurant.whatsappPhone} />

      <details className="card mt-4">
        <summary className="cursor-pointer text-xl font-bold">Cambiar contraseña</summary>
        <div className="mt-4">
          <ChangePasswordForm />
        </div>
      </details>
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
