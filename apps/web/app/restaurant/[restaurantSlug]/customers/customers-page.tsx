import Link from "next/link";
import { notFound } from "next/navigation";
import { getRestaurantCustomersWithStats } from "@/lib/data";
import { formatMoney } from "@/lib/format";
import { FavoriteButton } from "./favorite-button";

export const dynamic = "force-dynamic";

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  return months === 1 ? "hace 1 mes" : `hace ${months} meses`;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default async function CustomersPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  const data = await getRestaurantCustomersWithStats(restaurantSlug);
  if (!data) notFound();

  const { restaurant, customers } = data;
  const totalSpentAll = customers.reduce((s, c) => s + c.totalSpent, 0);
  const top3 = customers.filter(c => c.confirmedOrders > 0).slice(0, 3);
  const rest = customers.filter(c => !top3.includes(c));
  const returnPath = `/restaurant/${restaurantSlug}/customers`;

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6 2xl:max-w-6xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3 py-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-blue">{restaurant.name}</p>
          <h1 className="mt-1 text-3xl font-bold">Clientes</h1>
          <p className="mt-1 text-sm text-stone-500">
            {customers.length} cliente{customers.length !== 1 ? "s" : ""} ·{" "}
            {formatMoney(totalSpentAll)} en total confirmado
          </p>
        </div>
        <Link className="button-secondary" href={`/restaurant/${restaurantSlug}`}>← Consola</Link>
      </header>

      {customers.length === 0 ? (
        <section className="card text-stone-500">
          Aún no hay clientes registrados. Aparecerán cuando alguien haga su primer pedido.
        </section>
      ) : (
        <>
          {/* ── Podium ── */}
          {top3.length > 0 && (
            <section className="card mb-6">
              <h2 className="mb-4 text-lg font-bold">Top clientes del mes</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                {top3.map((c, i) => (
                  <div
                    key={c.id}
                    className={`flex-1 rounded-2xl p-4 border-2 ${
                      i === 0 ? "border-yellow-400 bg-yellow-50" :
                      i === 1 ? "border-stone-400 bg-stone-50" :
                      "border-orange-400 bg-orange-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-3xl">{MEDALS[i]}</span>
                      <FavoriteButton
                        customerId={c.id}
                        favorite={c.favorite}
                        returnPath={returnPath}
                      />
                    </div>
                    <p className="font-bold text-stone-900 truncate">{c.name}</p>
                    <p className="text-xs text-stone-500 mb-2">{c.phone}</p>
                    <p className={`text-xl font-black ${i === 0 ? "text-yellow-700" : i === 1 ? "text-stone-600" : "text-orange-700"}`}>
                      {formatMoney(c.totalSpent)}
                    </p>
                    <p className="text-xs text-stone-500">{c.confirmedOrders} pedidos · prom. {formatMoney(c.avgOrder)}</p>
                    {c.lastOrderDate && (
                      <p className="text-xs text-stone-400 mt-1">Última compra: {timeAgo(c.lastOrderDate)}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Full list ── */}
          <div className="space-y-2">
            {customers.map((c, idx) => {
              const medalIdx = top3.indexOf(c);
              return (
                <details className="card group" key={c.id}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {/* Medal / star */}
                      <span className="shrink-0 text-lg">
                        {medalIdx >= 0 ? MEDALS[medalIdx] : c.favorite ? "⭐" : ""}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-stone-900 truncate">{c.name}</p>
                        <p className="text-sm text-stone-500">{c.phone}</p>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-6 shrink-0 text-right">
                      <div>
                        <p className="text-xs text-stone-400">Pedidos</p>
                        <p className="font-bold">{c.confirmedOrders}</p>
                      </div>
                      <div>
                        <p className="text-xs text-stone-400">Total gastado</p>
                        <p className="font-bold text-brand-blue">{formatMoney(c.totalSpent)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-stone-400">Promedio</p>
                        <p className="font-semibold text-stone-700">{formatMoney(c.avgOrder)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-stone-400">Última compra</p>
                        <p className="text-sm text-stone-600">{c.lastOrderDate ? timeAgo(c.lastOrderDate) : "—"}</p>
                      </div>
                    </div>
                    <div className="flex sm:hidden flex-col items-end shrink-0 gap-0.5">
                      <p className="font-bold text-brand-blue">{formatMoney(c.totalSpent)}</p>
                      <p className="text-xs text-stone-400">{c.confirmedOrders} pedidos</p>
                    </div>
                    <span className="text-xs text-stone-400 group-open:hidden shrink-0">Ver ▾</span>
                    <span className="hidden text-xs text-stone-400 group-open:inline shrink-0">Cerrar ▴</span>
                  </summary>

                  <div className="mt-4 border-t border-stone-100 pt-4 space-y-3">
                    <div className="flex sm:hidden gap-4 text-sm">
                      <div><p className="text-xs text-stone-400">Promedio/pedido</p><p className="font-semibold">{formatMoney(c.avgOrder)}</p></div>
                      <div><p className="text-xs text-stone-400">Última compra</p><p className="font-semibold">{c.lastOrderDate ? timeAgo(c.lastOrderDate) : "—"}</p></div>
                    </div>
                    <p className="text-sm text-stone-600"><span className="font-medium text-stone-700">Dirección:</span> {c.lastAddress}</p>

                    <div className="flex flex-wrap items-center gap-3">
                      <FavoriteButton customerId={c.id} favorite={c.favorite} returnPath={returnPath} />
                      {(() => {
                        const digits = c.phone.replace(/\D/g, "");
                        const wa = digits.startsWith("57") ? digits : `57${digits}`;
                        const text = encodeURIComponent(`Hola ${c.name}! 👋 Te contactamos desde ${restaurant.name}.`);
                        return (
                          <a className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#1ebe5d] transition" href={`https://wa.me/${wa}?text=${text}`} rel="noreferrer" target="_blank">
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                            Contactar por WhatsApp
                          </a>
                        );
                      })()}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
