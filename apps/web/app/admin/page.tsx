import Link from "next/link";
import { deleteRestaurant, deleteRestaurantOrders, deleteRestaurantOrdersByDate, setRestaurantPassword } from "@/app/actions";
import { logoutAction } from "@/app/login/actions";
import { CreateRestaurantForm } from "@/components/create-restaurant-form";
import { RestaurantSettings } from "@/components/restaurant-settings";
import { formatMoney, formatOrderNumber } from "@/lib/format";
import { getAdminRestaurants } from "@/lib/data";

export default async function AdminPage() {
  const restaurants = await getAdminRestaurants();
  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4 py-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">Administración</p>
          <h1 className="mt-1 text-3xl font-bold">Restaurantes</h1>
        </div>
        <form action={logoutAction}>
          <button className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50" type="submit">
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

              <div className="mt-5">
                <RestaurantSettings menu={menu} restaurant={restaurant} returnPath="/admin" />
              </div>

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
