import Link from "next/link";
import { notFound } from "next/navigation";
import { getRestaurantAnalytics } from "@/lib/data";
import { formatDateKey, formatMoney, localDateKey } from "@/lib/format";

function buildWeeks(daily: { orderDate: string; revenue: number; count: number }[]) {
  const byWeek: Record<string, { revenue: number; count: number }> = {};
  for (const d of daily) {
    const date = new Date(`${d.orderDate}T12:00:00Z`);
    // ISO week start: Monday
    const day = date.getUTCDay() || 7;
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - day + 1);
    const key = monday.toISOString().slice(0, 10);
    if (!byWeek[key]) byWeek[key] = { revenue: 0, count: 0 };
    byWeek[key].revenue += d.revenue;
    byWeek[key].count += d.count;
  }
  return Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8);
}

export default async function AnalyticsPage({ params }: { params: Promise<{ restaurantSlug: string }> }) {
  const { restaurantSlug } = await params;
  const data = await getRestaurantAnalytics(restaurantSlug);
  if (!data) notFound();

  const today = localDateKey();
  const daily = data.daily.map((d) => ({
    orderDate: d.orderDate,
    revenue: Number(d._sum.total ?? 0),
    count: d._count.id,
  }));

  const todayRow = daily.find((d) => d.orderDate === today);
  const last7 = daily.filter((d) => d.orderDate >= (() => {
    const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10);
  })());
  const last30 = daily.slice(-30);

  const weekRevenue = last7.reduce((s, d) => s + d.revenue, 0);
  const weekCount = last7.reduce((s, d) => s + d.count, 0);
  const monthRevenue = last30.reduce((s, d) => s + d.revenue, 0);
  const monthCount = last30.reduce((s, d) => s + d.count, 0);

  const confirmedTotal = data.totals.find((t) => t.status === "PAYMENT_CONFIRMED");
  const allTimeRevenue = Number(confirmedTotal?._sum?.total ?? 0);
  const allTimeCount = confirmedTotal?._count?.id ?? 0;

  const weeks = buildWeeks(daily);
  const maxDaily = Math.max(...last30.map((d) => d.revenue), 1);
  const maxWeekly = Math.max(...weeks.map(([, w]) => w.revenue), 1);

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">Analíticas</p>
          <h1 className="mt-1 text-3xl font-bold">{data.restaurant.name}</h1>
        </div>
        <Link className="button-secondary" href={`/restaurant/${restaurantSlug}`}>Consola</Link>
      </header>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Hoy" revenue={todayRow?.revenue ?? 0} count={todayRow?.count ?? 0} highlight />
        <StatCard label="Últimos 7 días" revenue={weekRevenue} count={weekCount} />
        <StatCard label="Últimos 30 días" revenue={monthRevenue} count={monthCount} />
        <StatCard label="Total histórico" revenue={allTimeRevenue} count={allTimeCount} />
      </div>

      {/* Daily chart — last 30 days */}
      <section className="card mt-6">
        <h2 className="mb-4 text-lg font-bold">Ingresos diarios — últimos 30 días</h2>
        {last30.length === 0 ? (
          <p className="text-stone-500">Sin datos suficientes todavía.</p>
        ) : (
          <BarChart
            bars={last30.map((d) => ({
              label: d.orderDate.slice(5), // MM-DD
              value: d.revenue,
              max: maxDaily,
              sublabel: String(d.count),
              isToday: d.orderDate === today,
            }))}
          />
        )}
      </section>

      {/* Weekly chart */}
      <section className="card mt-4">
        <h2 className="mb-4 text-lg font-bold">Ingresos semanales — últimas 8 semanas</h2>
        {weeks.length === 0 ? (
          <p className="text-stone-500">Sin datos suficientes todavía.</p>
        ) : (
          <BarChart
            bars={weeks.map(([key, w]) => ({
              label: key.slice(5),
              value: w.revenue,
              max: maxWeekly,
              sublabel: `${w.count} órd.`,
            }))}
          />
        )}
      </section>

      {/* Daily detail table — last 14 days */}
      <section className="card mt-4 overflow-x-auto">
        <h2 className="mb-4 text-lg font-bold">Detalle diario — últimos 14 días</h2>
        {daily.length === 0 ? (
          <p className="text-stone-500">Sin datos todavía.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="pb-2 pr-4 font-medium">Fecha</th>
                <th className="pb-2 pr-4 font-medium text-right">Pedidos</th>
                <th className="pb-2 font-medium text-right">Total confirmado</th>
              </tr>
            </thead>
            <tbody>
              {daily.slice(-14).reverse().map((d) => (
                <tr className={`border-b border-stone-100 ${d.orderDate === today ? "bg-teal-50 font-semibold" : ""}`} key={d.orderDate}>
                  <td className="py-2 pr-4 capitalize">
                    <Link className="hover:text-teal-600" href={`/restaurant/${restaurantSlug}/history/${d.orderDate}`}>
                      {d.orderDate === today ? "Hoy" : formatDateKey(d.orderDate)}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-right">{d.count}</td>
                  <td className="py-2 text-right">{formatMoney(d.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, revenue, count, highlight }: { label: string; revenue: number; count: number; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-teal-300 bg-teal-50" : "border-stone-200 bg-white"}`}>
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-stone-900">{formatMoney(revenue)}</p>
      <p className="mt-0.5 text-sm text-stone-400">{count} {count === 1 ? "pedido" : "pedidos"}</p>
    </div>
  );
}

function BarChart({ bars }: {
  bars: { label: string; value: number; max: number; sublabel: string; isToday?: boolean }[];
}) {
  return (
    <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ minHeight: "10rem" }}>
      {bars.map((bar, i) => {
        const pct = bar.max > 0 ? Math.max((bar.value / bar.max) * 100, bar.value > 0 ? 4 : 0) : 0;
        return (
          <div className="flex min-w-[2rem] flex-1 flex-col items-center gap-1" key={i}>
            <span className="text-xs text-stone-500">{bar.sublabel}</span>
            <div
              className={`w-full rounded-t-md ${bar.isToday ? "bg-teal-500" : "bg-teal-200"}`}
              style={{ height: `${pct}%`, minHeight: bar.value > 0 ? "0.5rem" : "2px" }}
              title={formatMoney(bar.value)}
            />
            <span className={`text-xs ${bar.isToday ? "font-bold text-teal-700" : "text-stone-400"}`}>
              {bar.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
