import Link from "next/link";
import { notFound } from "next/navigation";
import { getRestaurantAnalytics, getRestaurantIngredientAnalytics } from "@/lib/data";
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
  const [data, ingredients] = await Promise.all([
    getRestaurantAnalytics(restaurantSlug),
    getRestaurantIngredientAnalytics(restaurantSlug),
  ]);
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
  const maxWeekly = Math.max(...weeks.map(([, w]) => w.revenue), 1);

  // Revenue by weekday over the last 30 days — answers "which day sells most".
  const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const byWeekday = WEEKDAYS.map(() => ({ revenue: 0, count: 0 }));
  for (const d of last30) {
    const wd = new Date(`${d.orderDate}T12:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
    const idx = (wd + 6) % 7; // Monday=0 … Sunday=6
    byWeekday[idx].revenue += d.revenue;
    byWeekday[idx].count += d.count;
  }
  const maxWeekday = Math.max(...byWeekday.map((w) => w.revenue), 1);

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

      {/* Ingredient analytics — most sold this month */}
      {ingredients && ingredients.total > 0 && (
        <section className="card mt-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">Ingredientes más vendidos</h2>
            <span className="text-sm text-stone-500 capitalize">{ingredients.monthLabel} · {ingredients.total} almuerzos confirmados</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <IngredientCard label="Sopas" items={ingredients.soups} total={ingredients.total} />
            <IngredientCard label="Proteínas" items={ingredients.proteins} total={ingredients.total} />
            <IngredientCard label="Principios" items={ingredients.sides} total={ingredients.total} />
            <IngredientCard label="Bebidas" items={ingredients.drinks} total={ingredients.total} />
          </div>
        </section>
      )}

      {/* Revenue by weekday — last 30 days */}
      <section className="card mt-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">Ingresos por día de la semana</h2>
          <span className="text-sm text-stone-500">últimos 30 días</span>
        </div>
        {monthCount === 0 ? (
          <p className="text-stone-500">Sin datos suficientes todavía.</p>
        ) : (
          <BarList
            rows={byWeekday.map((w, i) => ({
              label: WEEKDAYS[i],
              value: w.revenue,
              valueLabel: formatMoney(w.revenue),
              hint: `${w.count} ${w.count === 1 ? "pedido" : "pedidos"}`,
              max: maxWeekday,
              highlight: w.revenue === maxWeekday && w.revenue > 0,
            }))}
          />
        )}
      </section>

      {/* Weekly revenue — last 8 weeks */}
      <section className="card mt-4">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">Ingresos semanales</h2>
          <span className="text-sm text-stone-500">últimas 8 semanas</span>
        </div>
        {weeks.length === 0 ? (
          <p className="text-stone-500">Sin datos suficientes todavía.</p>
        ) : (
          <BarList
            rows={weeks.map(([key, w]) => ({
              label: `Semana del ${key.slice(5)}`,
              value: w.revenue,
              valueLabel: formatMoney(w.revenue),
              hint: `${w.count} órd.`,
              max: maxWeekly,
              highlight: w.revenue === maxWeekly && w.revenue > 0,
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

/**
 * Pastel bar color by share of the row's max. Uses an analogous cool palette
 * (emerald → teal → cyan → sky) so higher values read "warmer/greener" and lower
 * ones "cooler/bluer" — varied but harmonious, never a rainbow. Static class
 * names so Tailwind keeps them.
 */
function barColor(ratio: number): string {
  if (ratio >= 0.75) return "bg-emerald-400";
  if (ratio >= 0.5) return "bg-teal-400";
  if (ratio >= 0.25) return "bg-cyan-400";
  return "bg-sky-400";
}

/**
 * Horizontal bar list — same visual language as the ingredient breakdown.
 * Reads well on mobile (rows stack vertically, no horizontal scroll) and makes
 * differences between rows obvious because each bar is scaled to the max value.
 */
function BarList({ rows }: {
  rows: { label: string; value: number; valueLabel: string; hint?: string; max: number; highlight?: boolean }[];
}) {
  return (
    <div className="space-y-3">
      {rows.map((r, i) => {
        const ratio = r.max > 0 ? r.value / r.max : 0;
        const pct = Math.max(ratio * 100, r.value > 0 ? 3 : 0);
        return (
          <div key={i}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-stone-900">{r.label}</span>
              <span className="shrink-0 text-stone-500">
                <strong className={r.highlight ? "text-emerald-600" : "text-stone-900"}>{r.valueLabel}</strong>
                {r.hint ? ` · ${r.hint}` : ""}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
              <div
                className={`h-full rounded-full ${barColor(ratio)}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IngredientCard({ label, items, total }: { label: string; items: [string, number][]; total: number }) {
  const max = items[0]?.[1] ?? 1;
  return (
    <div>
      <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-stone-500">{label}</p>
      <div className="space-y-2">
        {items.slice(0, 6).map(([name, count]) => (
          <div key={name}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-medium text-stone-900">{name}</span>
              <span className="shrink-0 text-xs text-stone-500">{count} ({Math.round((count / total) * 100)}%)</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-teal-400"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-stone-400">Sin datos este mes.</p>}
      </div>
    </div>
  );
}
