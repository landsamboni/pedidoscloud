import Link from "next/link";
import { notFound } from "next/navigation";
import { getRestaurantOrderDates } from "@/lib/data";
import { formatDateKey, formatMoney, localDateKey } from "@/lib/format";

export default async function HistoryPage({ params }: { params: Promise<{ restaurantSlug: string }> }) {
  const { restaurantSlug } = await params;
  const data = await getRestaurantOrderDates(restaurantSlug);
  if (!data) notFound();

  const today = localDateKey();

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">Historial de pedidos</p>
          <h1 className="mt-1 text-3xl font-bold">{data.restaurant.name}</h1>
          <p className="mt-1 text-sm text-stone-500">Pedidos de los últimos {data.dates.length} días con actividad.</p>
        </div>
        <Link className="button-secondary" href={`/restaurant/${restaurantSlug}`}>Consola</Link>
      </header>

      {data.dates.length === 0 ? (
        <section className="card text-stone-600">Aún no hay pedidos registrados.</section>
      ) : (
        <div className="space-y-2">
          {data.dates.map((row) => {
            const isToday = row.orderDate === today;
            return (
              <Link
                className={`card flex items-center justify-between gap-4 transition hover:border-teal-300 hover:shadow-md ${isToday ? "border-teal-300 bg-teal-50" : ""}`}
                href={`/restaurant/${restaurantSlug}/history/${row.orderDate}`}
                key={row.orderDate}
              >
                <div>
                  <p className="font-semibold text-stone-900 capitalize">
                    {isToday ? "Hoy · " : ""}{formatDateKey(row.orderDate)}
                  </p>
                  <p className="mt-0.5 text-sm text-stone-500">
                    {row._count.id} {row._count.id === 1 ? "pedido" : "pedidos"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-stone-900">{formatMoney(Number(row._sum.total ?? 0))}</p>
                  <p className="text-xs text-stone-400">total facturado</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
