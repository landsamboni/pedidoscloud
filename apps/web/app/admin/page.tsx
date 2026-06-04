import Link from "next/link";
import { deactivateRestaurantSubscription, deleteRestaurant, deleteRestaurantOrders, deleteRestaurantOrdersByDate, populateDemoData, setRestaurantPassword, setRestaurantSubscription } from "@/app/actions";
import { getDaysRemaining, getSubscriptionStatus, STATUS_COLORS, STATUS_LABELS } from "@/lib/subscription";
import { logoutAction } from "@/app/login/actions";
import { CreateRestaurantForm } from "@/components/create-restaurant-form";
import { RestaurantSettings } from "@/components/restaurant-settings";
import { formatMoney, formatOrderNumber } from "@/lib/format";
import { getAdminRestaurants } from "@/lib/data";

// Authenticated dashboard backed by the database — always render on demand.
// Without this, Next.js tries to prerender /admin at build time and hits the DB
// (which CodeBuild cannot reach in the VPC setup), breaking the Amplify build.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const restaurants = await getAdminRestaurants();
  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6 3xl:max-w-7xl 4xl:max-w-[110rem]">
      <header className="flex flex-wrap items-start justify-between gap-4 py-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">Administración</p>
          <h1 className="mt-1 text-3xl font-bold">Restaurantes</h1>
        </div>
        <form action={logoutAction}>
          <button className="button-danger" type="submit">
            Cerrar sesión
          </button>
        </form>
      </header>

      <section className="card">
        <h2 className="mb-4 text-lg font-bold">Crear restaurante</h2>
        <CreateRestaurantForm />
      </section>

      <div className="mt-6 space-y-6">
        {restaurants.map((restaurant) => {
          const menu = restaurant.menus[0];
          return (
            <section className="card" key={restaurant.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{restaurant.name}</h2>
                  <p className="text-sm text-stone-500">/{restaurant.slug} · {formatMoney(Number(restaurant.basePrice))}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${restaurant.passwordHash ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {restaurant.passwordHash ? "Contraseña configurada" : "Sin contraseña"}
                  </span>
                  <Link className="button-secondary" href={`/r/${restaurant.slug}`}>Página cliente</Link>
                  <Link className="button-secondary" href={`/restaurant/${restaurant.slug}/orders`}>Tablero</Link>
                  <Link className="button-secondary" href={`/restaurant/${restaurant.slug}`}>Consola restaurante</Link>
                  <Link className="button-secondary" href={`/admin/customers/${restaurant.slug}`}>Clientes</Link>
                </div>
              </div>

              {/* Subscription management */}
              {(() => {
                const status = getSubscriptionStatus(restaurant.subscriptionEndsAt ?? null);
                const daysLeft = restaurant.subscriptionEndsAt ? getDaysRemaining(restaurant.subscriptionEndsAt) : null;
                const endsAtStr = restaurant.subscriptionEndsAt
                  ? new Date(restaurant.subscriptionEndsAt).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })
                  : null;

                // Default end date for "set-date" = today + 30 days
                const defaultEndDate = new Date();
                defaultEndDate.setDate(defaultEndDate.getDate() + 30);
                const defaultEndDateStr = defaultEndDate.toISOString().slice(0, 10);

                return (
                  <div className="mt-5 rounded-xl border border-stone-200 p-4">
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      <h3 className="font-semibold">Suscripción</h3>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[status]}`}>
                        {STATUS_LABELS[status]}
                      </span>
                      {daysLeft !== null && (
                        <span className="text-sm text-stone-500">
                          {daysLeft > 0
                            ? `${daysLeft} día${daysLeft !== 1 ? "s" : ""} restante${daysLeft !== 1 ? "s" : ""}`
                            : daysLeft === 0 ? "Vence hoy"
                            : `Venció hace ${Math.abs(daysLeft)} día${Math.abs(daysLeft) !== 1 ? "s" : ""}`}
                        </span>
                      )}
                      {endsAtStr && <span className="text-xs text-stone-400">Hasta: {endsAtStr}</span>}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      {/* Action 1 — Standard renewal (+30 days from correct base) */}
                      <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                        <p className="text-xs font-semibold text-stone-700">Renovar (+30 días)</p>
                        <p className="mt-0.5 text-xs text-stone-500">Registra el pago recibido. Extiende 30 días desde la base correcta.</p>
                        <form action={setRestaurantSubscription} className="mt-2 space-y-2">
                          <input name="restaurantId" type="hidden" value={restaurant.id} />
                          <input name="mode" type="hidden" value="renew" />
                          <input
                            className="input text-sm"
                            defaultValue={new Date().toISOString().slice(0, 10)}
                            max={new Date().toISOString().slice(0, 10)}
                            name="paymentDate"
                            required
                            title="Fecha en que recibiste el pago"
                            type="date"
                          />
                          <button className="button-primary w-full text-sm" type="submit">
                            {status === "no-subscription" ? "Activar" : "Registrar pago"}
                          </button>
                        </form>
                      </div>

                      {/* Action 2 — Set specific end date (manual override) */}
                      <div className="rounded-xl border border-teal-200 bg-teal-50 p-3">
                        <p className="text-xs font-semibold text-teal-800">Fijar fecha de vencimiento</p>
                        <p className="mt-0.5 text-xs text-teal-700">Override manual. Define exactamente hasta cuándo está activa.</p>
                        <form action={setRestaurantSubscription} className="mt-2 space-y-2">
                          <input name="restaurantId" type="hidden" value={restaurant.id} />
                          <input name="mode" type="hidden" value="set-date" />
                          <input
                            className="input text-sm"
                            defaultValue={defaultEndDateStr}
                            min={new Date().toISOString().slice(0, 10)}
                            name="endDate"
                            required
                            title="Fecha hasta la que estará activa la suscripción"
                            type="date"
                          />
                          <button className="button-primary w-full text-sm" type="submit">Aplicar</button>
                        </form>
                      </div>

                      {/* Action 3 — Deactivate immediately */}
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                        <p className="text-xs font-semibold text-red-800">Desactivar ahora</p>
                        <p className="mt-0.5 text-xs text-red-700">Suspende el acceso de forma inmediata. Útil ante impagos o cancelaciones.</p>
                        <form action={deactivateRestaurantSubscription} className="mt-2">
                          <input name="restaurantId" type="hidden" value={restaurant.id} />
                          <button
                            className="w-full rounded-xl border border-red-400 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                            type="submit"
                          >
                            Desactivar suscripción
                          </button>
                        </form>
                      </div>
                    </div>

                    {/* WhatsApp reminder button */}
                    {(() => {
                      const waPhone = (restaurant.whatsappPhone ?? restaurant.nequiPhone ?? "").replace(/\D/g, "");
                      if (!waPhone) return null;
                      const waNumber = waPhone.startsWith("57") ? waPhone : `57${waPhone}`;
                      const endDate = restaurant.subscriptionEndsAt
                        ? new Date(restaurant.subscriptionEndsAt).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
                        : null;

                      const messages: Record<typeof status, string> = {
                        "no-subscription":
                          `¡Hola ${restaurant.name}! 👋 Te damos la bienvenida a PedidosCloud. Para activar tu suscripción y empezar a recibir pedidos en línea, realiza tu pago y notifícanos. ¡Estamos aquí para ayudarte a crecer! 🚀`,
                        "active":
                          `¡Hola ${restaurant.name}! 😊 Todo está en orden con tu suscripción de PedidosCloud, que renueva el ${endDate}. Cuando llegue la fecha, recuerda hacer tu pago para seguir sin interrupciones. ¡Gracias por confiar en nosotros! 🙌`,
                        "expiring-soon":
                          `¡Hola ${restaurant.name}! ⏰ Te recordamos que tu suscripción de PedidosCloud vence el ${endDate}. Para seguir recibiendo pedidos sin interrupciones, realiza tu pago antes de esa fecha. ¡Contamos contigo! 💪`,
                        "suspended":
                          `¡Hola ${restaurant.name}! Tu cuenta en PedidosCloud está suspendida por falta de pago. Para reactivarla, realiza tu pago de renovación y avísanos. ¡Te esperamos de vuelta pronto! 😊`,
                      };

                      const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(messages[status])}`;
                      return (
                        <a
                          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1ebe5d]"
                          href={waUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                          Notificar por WhatsApp
                        </a>
                      );
                    })()}

                    {status === "expiring-soon" && (
                      <p className="mt-2 text-xs text-amber-700">
                        ⏰ Próximo a vencer. Recuerda confirmar el pago antes de la fecha de corte.
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="mt-5">
                <RestaurantSettings menu={menu} menuPublishedToday={!!menu} restaurant={restaurant} restaurantSlug={restaurant.slug} returnPath="/admin" />
              </div>

              {/* Demo data generator — populate for sales presentations */}
              <details className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-teal-800">
                  🎬 Poblar datos demo (últimos 15 días)
                </summary>
                <p className="mt-2 text-xs text-teal-700">
                  Genera órdenes y clientes ficticios de los últimos 15 días para mostrar el dashboard en presentaciones de ventas. Se agregan a los datos existentes.
                </p>
                <form action={populateDemoData} className="mt-3">
                  <input name="restaurantId" type="hidden" value={restaurant.id} />
                  <button className="button-primary text-sm" type="submit">
                    Generar datos demo
                  </button>
                </form>
              </details>

              {/* Danger zone — order cleanup */}
              <details className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-red-700">
                  ⚠ Zona peligrosa — eliminar órdenes
                </summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {/* Delete all orders */}
                  <div className="rounded-xl border border-red-300 bg-white p-4">
                    <p className="text-sm font-semibold text-red-800">Eliminar TODO el historial</p>
                    <p className="mt-1 text-xs text-red-600">
                      Borra todas las órdenes y contadores de este restaurante. No se puede deshacer.
                    </p>
                    <form action={deleteRestaurantOrders} className="mt-3 space-y-2">
                      <input name="restaurantId" type="hidden" value={restaurant.id} />
                      <input name="slug" type="hidden" value={restaurant.slug} />
                      <label className="block text-xs font-medium text-red-700">
                        Escribe <strong>{restaurant.slug}</strong> para confirmar:
                        <input
                          className="input mt-1 text-sm"
                          name="confirmation"
                          placeholder={restaurant.slug}
                          required
                        />
                      </label>
                      <button className="w-full rounded-xl border border-red-400 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50" type="submit">
                        Eliminar todo el historial
                      </button>
                    </form>
                  </div>
                  {/* Delete by date */}
                  <div className="rounded-xl border border-red-300 bg-white p-4">
                    <p className="text-sm font-semibold text-red-800">Eliminar órdenes de un día</p>
                    <p className="mt-1 text-xs text-red-600">
                      Borra solo las órdenes de la fecha seleccionada.
                    </p>
                    <form action={deleteRestaurantOrdersByDate} className="mt-3 space-y-2">
                      <input name="restaurantId" type="hidden" value={restaurant.id} />
                      <label className="block text-xs font-medium text-red-700">
                        Fecha (YYYY-MM-DD):
                        <input className="input mt-1 text-sm" name="date" required type="date" />
                      </label>
                      <button className="w-full rounded-xl border border-red-400 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50" type="submit">
                        Eliminar órdenes del día
                      </button>
                    </form>
                  </div>
                  {/* Delete restaurant */}
                  <div className="rounded-xl border-2 border-red-400 bg-white p-4">
                    <p className="text-sm font-semibold text-red-900">Eliminar restaurante permanentemente</p>
                    <p className="mt-1 text-xs text-red-600">
                      Borra el restaurante, todas sus órdenes, menús, clientes y configuración. Irreversible.
                    </p>
                    <form action={deleteRestaurant} className="mt-3 space-y-2">
                      <input name="restaurantId" type="hidden" value={restaurant.id} />
                      <input name="slug" type="hidden" value={restaurant.slug} />
                      <label className="block text-xs font-medium text-red-700">
                        Escribe <strong>{restaurant.slug}</strong> para confirmar:
                        <input
                          className="input mt-1 text-sm"
                          name="confirmation"
                          placeholder={restaurant.slug}
                          required
                        />
                      </label>
                      <button className="w-full rounded-xl border-2 border-red-500 bg-red-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-red-600" type="submit">
                        Eliminar restaurante
                      </button>
                    </form>
                  </div>
                </div>
              </details>

              <div className="mt-5">
                <h3 className="font-semibold">Pedidos de hoy ({restaurant.orders.length})</h3>
                {restaurant.orders.length ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-stone-500">
                        <tr><th className="pb-2">Orden</th><th>Cliente</th><th>Estado</th><th>Total</th></tr>
                      </thead>
                      <tbody>
                        {restaurant.orders.map((order) => (
                          <tr className="border-t border-stone-100" key={order.id}>
                            <td className="py-2 font-semibold">{formatOrderNumber(order.orderNumber)}</td>
                            <td>{order.customer.name}</td>
                            <td>{order.status}</td>
                            <td>{formatMoney(Number(order.total))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="mt-2 text-sm text-stone-500">Sin pedidos todavía.</p>}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
