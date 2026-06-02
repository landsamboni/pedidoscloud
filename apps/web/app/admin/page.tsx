import Link from "next/link";
import { createRestaurant } from "@/app/actions";
import { RestaurantSettings } from "@/components/restaurant-settings";
import { formatMoney, formatOrderNumber } from "@/lib/format";
import { getAdminRestaurants } from "@/lib/data";

export default async function AdminPage() {
  const restaurants = await getAdminRestaurants();
  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <header className="py-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-600">Administración</p>
        <h1 className="mt-1 text-3xl font-bold">Restaurantes</h1>
      </header>

      <section className="card">
        <h2 className="text-lg font-bold">Crear restaurante</h2>
        <form action={createRestaurant} className="mt-4 grid gap-3 sm:grid-cols-4">
          <input className="input" name="name" placeholder="Nombre" required />
          <input className="input" name="slug" placeholder="slug-del-restaurante" required />
          <input className="input" min="1" name="basePrice" placeholder="Precio base" required type="number" />
          <button className="button-primary">Crear</button>
        </form>
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
                <div className="flex flex-wrap gap-2">
                  <Link className="button-secondary" href={`/r/${restaurant.slug}`}>Página cliente</Link>
                  <Link className="button-secondary" href={`/restaurant/${restaurant.slug}/orders`}>Tablero</Link>
                  <Link className="button-secondary" href={`/restaurant/${restaurant.slug}`}>Consola restaurante</Link>
                </div>
              </div>

              <div className="mt-5">
                <RestaurantSettings menu={menu} restaurant={restaurant} returnPath="/admin" />
              </div>

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
