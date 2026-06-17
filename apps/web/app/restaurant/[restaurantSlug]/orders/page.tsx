import Link from "next/link";
import { notFound } from "next/navigation";
import { RestaurantOrders } from "@/components/restaurant-orders";
import { cleanupStaleOrders, getTodayOrders } from "@/lib/data";
import { resolveFileUrl } from "@/lib/file-url";
import { formatMoney, formatOrderNumber, formatTime } from "@/lib/format";
import { parseItemName } from "@/lib/menu";

// Sort unverified orders first (need action), verified/done at the end.
const STATUS_PRIORITY: Record<string, number> = {
  PAYMENT_REVIEW: 0,
  PAYMENT_PENDING: 1,
  NEW: 2,
  PAYMENT_REJECTED: 3,
  PAYMENT_CONFIRMED: 4,
  CANCELLED: 5,
};

const STATUS_LABELS: Record<string, string> = {
  PAYMENT_REVIEW: "Revisar comprobante",
  PAYMENT_PENDING: "Pago pendiente",
  NEW: "Nuevo",
  PAYMENT_REJECTED: "Rechazado",
  PAYMENT_CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
};

/** Strip all non-digits and remove a leading Colombian country code (57). */
function normalizeDigits(v: string): string {
  const d = v.replace(/\D/g, "");
  return d.startsWith("57") && d.length > 10 ? d.slice(2) : d;
}

function matchesQuery(order: {
  orderNumber: number;
  customerName: string;
  status: string;
  address: string;
  customer: { name: string; phone: string };
  items: { catalogItem: string; soup: string; protein: string; side: string; drink: string }[];
}, q: string): boolean {
  const raw = q.trim();
  if (!raw) return true;
  const lower = raw.toLowerCase();

  // Order number: "#004", "004", "4" — only try if the query looks like a number
  const queryDigits = normalizeDigits(raw);
  const orderNum = String(order.orderNumber);
  if (queryDigits && queryDigits.length <= orderNum.length && orderNum.includes(queryDigits)) return true;
  if (formatOrderNumber(order.orderNumber).toLowerCase().includes(lower)) return true;

  // Customer name (both stored snapshot and customer record)
  const nameLower = lower.replace(/\s+/g, " ").trim();
  if ((order.customerName ?? "").toLowerCase().includes(nameLower)) return true;
  if (order.customer.name.toLowerCase().includes(nameLower)) return true;

  // Phone — compare normalised digits; partial match allowed (min 4 digits to avoid noise)
  if (queryDigits.length >= 4) {
    const storedPhone = normalizeDigits(order.customer.phone ?? "");
    if (storedPhone.includes(queryDigits)) return true;
  }

  // Address
  if (order.address.toLowerCase().includes(lower)) return true;

  // Status label
  if ((STATUS_LABELS[order.status] ?? "").toLowerCase().includes(lower)) return true;

  // Catalog items
  if (order.items.some(i => (i.catalogItem ?? "").toLowerCase().includes(lower))) return true;

  // Combo items
  if (order.items.some(i =>
    parseItemName(i.soup).toLowerCase().includes(lower) ||
    parseItemName(i.protein).toLowerCase().includes(lower) ||
    parseItemName(i.side).toLowerCase().includes(lower) ||
    parseItemName(i.drink).toLowerCase().includes(lower),
  )) return true;

  return false;
}

const GROUP_STATUSES: Record<string, string[]> = {
  review:    ["PAYMENT_REVIEW"],
  pending:   ["PAYMENT_PENDING", "NEW"],
  rejected:  ["PAYMENT_REJECTED"],
  confirmed: ["PAYMENT_CONFIRMED"],
  cancelled: ["CANCELLED"],
};

const GROUP_LABELS: Record<string, string> = {
  review:    "Revisar comprobante",
  pending:   "Pendientes de pago",
  rejected:  "Rechazados",
  confirmed: "Confirmados",
  cancelled: "Cancelados",
};

export default async function RestaurantOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ restaurantSlug: string }>;
  searchParams: Promise<{ q?: string; group?: string }>;
}) {
  const { restaurantSlug } = await params;
  const { q = "", group = "" } = await searchParams;
  const query = q.trim();
  const selectedGroup = GROUP_STATUSES[group] ? group : "";

  const restaurant = await getTodayOrders(restaurantSlug);
  if (!restaurant) notFound();

  await cleanupStaleOrders(restaurant.id);

  const allOrders = restaurant.orders
    .map((order) => ({
      ...order,
      total: order.total.toString(),
      totalLabel: formatMoney(Number(order.total)),
      deliveryFee: Number(order.deliveryFee),
      createdAtLabel: formatTime(order.createdAt),
      createdAtMs: order.createdAt.getTime(),
      paymentProofPath: resolveFileUrl(order.paymentProofPath),
      paymentSubmittedAtLabel: order.paymentSubmittedAt ? formatTime(order.paymentSubmittedAt) : null,
      items: order.items.map((item) => ({ ...item, price: item.price.toString(), unitPrice: item.unitPrice.toString() })),
      customer: { ...order.customer, name: order.customerName, favorite: order.customer.favorite },
    }))
    .sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status] ?? 9;
      const pb = STATUS_PRIORITY[b.status] ?? 9;
      if (pa !== pb) return pa - pb;
      return a.orderNumber - b.orderNumber;
    });

  // Apply group filter first, then text search on top
  const groupFiltered = selectedGroup
    ? allOrders.filter((o) => (GROUP_STATUSES[selectedGroup] ?? []).includes(o.status))
    : allOrders;
  const orders = query ? groupFiltered.filter((o) => matchesQuery(o, query)) : groupFiltered;
  const pending = allOrders.filter((o) => (STATUS_PRIORITY[o.status] ?? 9) < 4).length;

  return (
    <main className="mx-auto max-w-[2400px] p-4 sm:p-6 lg:p-6 lg:max-w-none">
      <header className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">Pedidos de hoy</p>
        <h1 className="mt-1 text-3xl font-bold">{restaurant.name}</h1>
        {selectedGroup ? (
          <div className="mt-1 flex items-center gap-3">
            <p className="text-sm text-stone-500">
              Filtrando por: <strong>{GROUP_LABELS[selectedGroup]}</strong>
              {orders.length > 0 && ` · ${orders.length} pedido${orders.length !== 1 ? "s" : ""}`}
            </p>
            <Link className="text-xs font-semibold text-brand-blue hover:underline" href={`/restaurant/${restaurantSlug}/orders`}>
              ✕ Ver todos
            </Link>
          </div>
        ) : query ? (
          <div className="mt-1 flex items-center gap-3">
            <p className="text-sm text-stone-500">
              {orders.length === 0
                ? `Sin resultados para "${query}"`
                : `${orders.length} resultado${orders.length !== 1 ? "s" : ""} para "${query}"`}
            </p>
            <Link className="text-xs font-semibold text-brand-blue hover:underline" href={`/restaurant/${restaurantSlug}/orders`}>
              ✕ Limpiar búsqueda
            </Link>
          </div>
        ) : (
          <p className="mt-1 text-sm text-stone-500">
            {pending > 0
              ? `${pending} pedido${pending > 1 ? "s" : ""} pendiente${pending > 1 ? "s" : ""} · se actualiza cada 10 s`
              : "Todo al día · se actualiza cada 10 s"}
          </p>
        )}
      </header>

      <RestaurantOrders restaurantName={restaurant.name} restaurantSlug={restaurantSlug} orders={orders} />
    </main>
  );
}
