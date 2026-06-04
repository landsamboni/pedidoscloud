import Link from "next/link";
import { notFound } from "next/navigation";
import { updateCustomer } from "@/app/actions";
import { DeleteCustomerForm } from "@/components/delete-customer-form";
import { getRestaurantCustomers } from "@/lib/data";

export default async function CustomersPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  const data = await getRestaurantCustomers(restaurantSlug);
  if (!data) notFound();

  const { restaurant, customers } = data;

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 py-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">
            Administración · {restaurant.name}
          </p>
          <h1 className="mt-1 text-3xl font-bold">Clientes registrados</h1>
          <p className="mt-1 text-sm text-stone-500">
            {customers.length} cliente{customers.length !== 1 ? "s" : ""} · ordenados por cantidad de pedidos
          </p>
        </div>
        <Link className="button-secondary" href="/admin">← Admin</Link>
      </header>

      {customers.length === 0 ? (
        <section className="card text-stone-600">Este restaurante aún no tiene clientes.</section>
      ) : (
        <div className="space-y-2">
          {customers.map((c) => (
            <details className="card group" key={c.id}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{c.name}</p>
                    <p className="text-sm text-stone-500">{c.phone} · {c.lastAddress}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                    {c._count.orders} pedido{c._count.orders !== 1 ? "s" : ""}
                  </span>
                  <span className="text-xs text-stone-400 group-open:hidden">Editar ▾</span>
                  <span className="hidden text-xs text-stone-400 group-open:inline">Cerrar ▴</span>
                </div>
              </summary>

              {/* Edit form */}
              <div className="mt-4 border-t border-stone-100 pt-4">
                <form action={updateCustomer} className="grid gap-3 sm:grid-cols-3">
                  <input name="customerId" type="hidden" value={c.id} />
                  <input name="restaurantSlug" type="hidden" value={restaurantSlug} />
                  <label className="text-sm font-medium text-stone-700">
                    Nombre
                    <input className="input mt-1" defaultValue={c.name} name="name" required />
                  </label>
                  <label className="text-sm font-medium text-stone-700">
                    Teléfono
                    <input className="input mt-1" defaultValue={c.phone} inputMode="tel" maxLength={15} name="phone" required />
                  </label>
                  <label className="text-sm font-medium text-stone-700">
                    Última dirección
                    <input className="input mt-1" defaultValue={c.lastAddress} name="lastAddress" />
                  </label>
                  <div className="flex items-center gap-3 sm:col-span-3">
                    <button className="button-primary" type="submit">Guardar cambios</button>
                    {c._count.orders > 0 && (
                      <p className="text-xs text-stone-400">
                        Tiene {c._count.orders} pedido{c._count.orders !== 1 ? "s" : ""} — se conservan al editar.
                      </p>
                    )}
                  </div>
                </form>

                {/* Delete */}
                <div className="mt-4 border-t border-stone-100 pt-4">
                  <DeleteCustomerForm customerId={c.id} name={c.name} orderCount={c._count.orders} restaurantSlug={restaurantSlug} />
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </main>
  );
}
