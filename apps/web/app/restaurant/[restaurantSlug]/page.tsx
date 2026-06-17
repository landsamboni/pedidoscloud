import Link from "next/link";
import { notFound } from "next/navigation";
import { RestaurantSettings } from "@/components/restaurant-settings";
import { BusinessDataForm } from "@/components/business-data-form";
import { DeliveryCard, PaymentCard } from "@/components/settings-cards";
import { ChangePasswordForm } from "@/components/change-password-form";
import { formatMoney, formatOrderNumber } from "@/lib/format";
import { getDaysRemaining, getSubscriptionStatus, STATUS_COLORS, STATUS_LABELS } from "@/lib/subscription";
import { getMenuForEditor, getTodayOrders } from "@/lib/data";

export default async function RestaurantConsolePage({ params }: { params: Promise<{ restaurantSlug: string }> }) {
  const { restaurantSlug } = await params;
  const restaurant = await getTodayOrders(restaurantSlug);
  if (!restaurant) notFound();

  const { menu, publishedToday } = await getMenuForEditor(restaurant.id);
  const catalogCategories = menu?.categories ?? [];

  const subStatus = getSubscriptionStatus(restaurant.subscriptionEndsAt ?? null);
  const daysLeft = restaurant.subscriptionEndsAt ? getDaysRemaining(restaurant.subscriptionEndsAt) : null;

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6 2xl:max-w-6xl 3xl:max-w-7xl">
      <header className="py-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">Consola del restaurante</p>
        <h1 className="mt-1 text-3xl font-bold">{restaurant.name}</h1>
        <p className="mt-1 text-stone-600">Administra tu menú, pagos Nequi y pedidos del día.</p>
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
        {/* Link para pedidos — full width, destacado */}
        <Link
          className="mb-3 flex w-full items-center justify-center rounded-2xl px-5 py-3.5 text-base font-bold text-white shadow-sm transition hover:opacity-90"
          href={`/r/${restaurantSlug}`}
          rel="noreferrer"
          style={{ backgroundColor: "#7B61FF" }}
          target="_blank"
        >
          Link para pedidos de clientes ↗
        </Link>

        {/* Navegación — grilla 2×2 en móvil, 4 columnas en desktop */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Pedidos de hoy", href: `/restaurant/${restaurantSlug}/orders`, blue: true },
            { label: "Historial",      href: `/restaurant/${restaurantSlug}/history` },
            { label: "Analíticas",     href: `/restaurant/${restaurantSlug}/analytics` },
            { label: "Clientes",       href: `/restaurant/${restaurantSlug}/customers` },
          ].map(({ label, href, blue }) => (
            <Link
              key={href}
              className={`flex items-center justify-center rounded-xl px-3 py-3 text-sm font-semibold text-center leading-tight transition hover:opacity-90 ${
                blue
                  ? "bg-brand-blue text-white"
                  : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
              }`}
              href={href}
            >
              {label}
            </Link>
          ))}
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
        <h2 className="mb-4 text-xl font-bold">Configuración del Menú</h2>
        <RestaurantSettings catalogCategories={catalogCategories} hidePassword menu={menu} menuPublishedToday={publishedToday} restaurant={restaurant} restaurantSlug={restaurantSlug} returnPath={`/restaurant/${restaurantSlug}`} />
      </section>

      <DeliveryCard
        allowPickup={restaurant.allowPickup}
        deliveryFee={restaurant.deliveryFee}
        deliveryMode={restaurant.deliveryMode}
        deliveryNote={restaurant.deliveryNote}
        restaurantId={restaurant.id}
        returnPath={`/restaurant/${restaurantSlug}`}
      />

      <PaymentCard
        nequiAccountName={restaurant.nequiAccountName}
        nequiPhone={restaurant.nequiPhone}
        nequiQrPath={restaurant.nequiQrPath}
        paymentMethods={restaurant.paymentMethods}
        restaurantId={restaurant.id}
        returnPath={`/restaurant/${restaurantSlug}`}
      />

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
