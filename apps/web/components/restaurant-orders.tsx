"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus } from "@/app/actions";
import { formatMoney, formatOrderNumber } from "@/lib/format";
import { parseItemName } from "@/lib/menu";

function relativeTime(createdAtMs: number, now: number): string {
  const mins = Math.floor((now - createdAtMs) / 60000);
  if (mins < 1) return "hace menos de 1 min";
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `hace ${h} h ${m} min` : `hace ${h} h`;
}

export type Order = {
  id: string;
  orderNumber: number;
  status: string;
  total: string;
  totalLabel: string;
  deliveryFee: number;
  fulfillment: string;
  address: string;
  createdAtLabel: string;
  createdAtMs: number;
  paymentProofPath: string | null;
  paymentSubmittedAtLabel: string | null;
  customer: { name: string; phone: string; favorite?: boolean };
  items: { id: string; soup: string; protein: string; side: string; drink: string; catalogCategory: string; catalogItem: string; quantity: number; unitPrice: string }[];
};

const statusLabels: Record<string, string> = {
  NEW: "Nuevo",
  PAYMENT_PENDING: "Pago pendiente",
  PAYMENT_REVIEW: "Revisar comprobante",
  PAYMENT_CONFIRMED: "Pago confirmado",
  PAYMENT_REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
};

const statusColors: Record<string, string> = {
  NEW: "bg-sky-100 text-sky-800",
  PAYMENT_PENDING: "bg-amber-100 text-amber-800",
  PAYMENT_REVIEW: "bg-purple-100 text-purple-800",
  PAYMENT_CONFIRMED: "bg-emerald-100 text-emerald-800",
  PAYMENT_REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-stone-200 text-stone-600",
};

const PENDING = new Set(["NEW", "PAYMENT_PENDING", "PAYMENT_REVIEW"]);

// Neutral secondary button — kept gray ON PURPOSE so the orders board preserves
// its own color system (the brand purple .button-secondary is not used here).
const NEUTRAL_BTN =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50";

// Sections always shown (even with count 0) — the accent applies to both nav pill and section title.
const GROUPS = [
  { key: "review",    label: "Revisar comprobante",   statuses: ["PAYMENT_REVIEW"],         accent: "text-purple-700 bg-purple-100 border-purple-300" },
  { key: "pending",   label: "Pendientes de pago",    statuses: ["PAYMENT_PENDING", "NEW"], accent: "text-amber-700 bg-amber-100 border-amber-300" },
  { key: "rejected",  label: "Rechazados",            statuses: ["PAYMENT_REJECTED"],       accent: "text-red-700 bg-red-100 border-red-300" },
  { key: "confirmed", label: "Confirmados",           statuses: ["PAYMENT_CONFIRMED"],      accent: "text-emerald-700 bg-emerald-100 border-emerald-300" },
  { key: "cancelled", label: "Cancelados",            statuses: ["CANCELLED"],              accent: "text-stone-700 bg-stone-200 border-stone-300" },
];

function urgencyBorder(order: Order, now: number | null): string {
  if (!now || !PENDING.has(order.status)) return "";
  const elapsed = now - order.createdAtMs;
  if (elapsed > 3 * 60 * 1000) return "border-red-400 ring-2 ring-red-100";
  if (elapsed > 2 * 60 * 1000) return "border-orange-400 ring-2 ring-orange-100";
  if (order.status === "PAYMENT_REVIEW") return "border-purple-400 ring-2 ring-purple-100";
  return "";
}

function buildCustomerWaUrl(order: Order, restaurantName: string): string | null {
  const digits = order.customer.phone.replace(/\D/g, "");
  if (!digits) return null;
  const waPhone = digits.startsWith("57") ? digits : `57${digits}`;
  const message = encodeURIComponent(
    `Hola ${order.customer.name}! Soy del restaurante ${restaurantName}. Te contactamos sobre tu pedido ${formatOrderNumber(order.orderNumber)}.`,
  );
  return `https://wa.me/${waPhone}?text=${message}`;
}

interface Props {
  restaurantSlug: string;
  restaurantName?: string;
  orders: Order[];
  readOnly?: boolean;
}

// Groups that start expanded — urgent / actionable.
const DEFAULT_OPEN = new Set(["review", "pending", "rejected"]);

export function RestaurantOrders({ restaurantSlug, restaurantName = "", orders, readOnly = false }: Props) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({});
  // Card expansion: false = compact view (no items), true = full view
  const [expandAll, setExpandAll] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  function isGroupOpen(key: string, count: number): boolean {
    if (key in openOverrides) return openOverrides[key];
    return count > 0;
  }

  function toggleGroup(key: string, count: number) {
    setOpenOverrides((prev) => ({ ...prev, [key]: !isGroupOpen(key, count) }));
  }

  function isCardExpanded(id: string): boolean {
    return expandAll || expandedCards.has(id);
  }

  function toggleCard(id: string) {
    if (expandAll) {
      // When global "expand all" is on, toggling a card collapses just that one
      setExpandAll(false);
      const all = new Set(orders.map(o => o.id));
      all.delete(id);
      setExpandedCards(all);
    } else {
      setExpandedCards(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    }
  }

  function handleExpandAll() {
    setExpandAll(true);
    setExpandedCards(new Set());
  }

  function handleCollapseAll() {
    setExpandAll(false);
    setExpandedCards(new Set());
  }

  useEffect(() => {
    setNow(Date.now());
    if (readOnly) return;
    // Only poll while the tab is visible. Operators typically keep the dashboard
    // in a background tab; pausing then keeps DB load flat as the number of
    // restaurants grows. On returning to the tab we refresh once immediately so
    // the operator never sees stale orders.
    const refresh = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 10_000);
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") router.refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(refresh);
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, readOnly]);

  const byStatus = useMemo(() => {
    const map: Record<string, Order[]> = {};
    for (const o of orders) (map[o.status] ??= []).push(o);
    return map;
  }, [orders]);

  if (!orders.length) {
    return <section className="card text-stone-600">Todavía no hay pedidos para hoy.</section>;
  }

  return (
    <>
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="mb-3 flex justify-end">
        {expandAll ? (
          <button
            className="text-xs font-semibold text-stone-500 hover:text-stone-700 transition"
            onClick={handleCollapseAll}
            type="button"
          >
            ↑ Colapsar todo
          </button>
        ) : (
          <button
            className="text-xs font-semibold text-brand-blue hover:underline transition"
            onClick={handleExpandAll}
            type="button"
          >
            ↓ Expandir todo
          </button>
        )}
      </div>

      {/* ── DESKTOP KANBAN (lg+) ─────────────────────────────────────────
          Five columns, one per status group. All orders visible at once
          without vertical scroll — the operator sees the full picture. */}
      <div className="hidden lg:block overflow-x-auto pb-6">
        <div className="flex gap-4 items-start" style={{ minWidth: `${GROUPS.length * 260}px` }}>
          {GROUPS.map((group) => {
            const groupOrders = group.statuses.flatMap((s) => byStatus[s] ?? []);
            return (
              <div key={group.key} className="flex flex-1 min-w-0 flex-col">
                {/* Column header — title filters to this group; count badge stays */}
                <div className={`mb-3 flex items-center justify-between rounded-xl border-2 px-3 py-2.5 ${group.accent}`}>
                  <Link
                    className="flex-1 text-sm font-bold leading-tight hover:underline"
                    href={`/restaurant/${restaurantSlug}/orders/${group.key}`}
                    title={`Ver solo: ${group.label}`}
                  >
                    {group.label}
                  </Link>
                  <span className="ml-2 shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-xs font-black tabular-nums">
                    {groupOrders.length}
                  </span>
                </div>
                {/* Cards */}
                <div className="space-y-3">
                  {groupOrders.length > 0 ? (
                    groupOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        expanded={isCardExpanded(order.id)}
                        now={now}
                        onToggle={() => toggleCard(order.id)}
                        onViewProof={setProofUrl}
                        order={order}
                        readOnly={readOnly}
                        restaurantName={restaurantName}
                        restaurantSlug={restaurantSlug}
                      />
                    ))
                  ) : (
                    <div className="rounded-2xl border-2 border-dashed border-stone-200 px-4 py-8 text-center text-sm text-stone-400 italic">
                      Sin pedidos
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MOBILE: collapsible sections (unchanged) ─────────────────── */}
      <div className="lg:hidden space-y-3">
        {GROUPS.map((group) => {
          const groupOrders = group.statuses.flatMap((s) => byStatus[s] ?? []);
          const isOpen = isGroupOpen(group.key, groupOrders.length);
          return (
            <section id={`section-${group.key}`} key={group.key} className="scroll-mt-4">
              <div className={`flex items-center justify-between rounded-2xl border-2 px-4 py-3 ${group.accent}`}>
                <Link
                  className="flex-1 text-sm font-bold hover:underline"
                  href={`/restaurant/${restaurantSlug}/orders/${group.key}`}
                >
                  {group.label}
                  <span className="ml-2 rounded-full bg-white/60 px-2 py-0.5 text-xs font-black">
                    {groupOrders.length}
                  </span>
                </Link>
                <button
                  aria-expanded={isOpen}
                  className="ml-2 shrink-0"
                  onClick={() => toggleGroup(group.key, groupOrders.length)}
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    className={`h-5 w-5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    viewBox="0 0 24 24"
                  >
                    <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              {!isOpen && groupOrders.length === 0 && (
                <p className="mt-1 px-2 text-xs text-stone-400 italic">Sin pedidos.</p>
              )}
              {isOpen && (
                <div className="mt-3">
                  {groupOrders.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
                      {groupOrders.map((order) => (
                        <OrderCard
                          key={order.id}
                          expanded={isCardExpanded(order.id)}
                          now={now}
                          onToggle={() => toggleCard(order.id)}
                          onViewProof={setProofUrl}
                          order={order}
                          readOnly={readOnly}
                          restaurantName={restaurantName}
                          restaurantSlug={restaurantSlug}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-stone-400 italic px-1">Sin pedidos en esta categoría.</p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* In-app proof modal */}
      {proofUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setProofUrl(null)}>
          <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-5 py-4">
              <p className="font-semibold">Comprobante de pago</p>
              <div className="flex items-center gap-3">
                <a className="text-sm font-medium text-teal-600 hover:underline" download href={proofUrl}>Descargar</a>
                <button className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100" onClick={() => setProofUrl(null)} type="button">✕</button>
              </div>
            </div>
            <div className="overflow-auto p-4">
              {proofUrl.toLowerCase().includes(".pdf") ? (
                <iframe className="h-[72vh] w-full rounded-xl" src={proofUrl} title="Comprobante PDF" />
              ) : (
                <img alt="Comprobante de pago" className="h-auto w-full rounded-xl" src={proofUrl} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function OrderCard({ order, restaurantSlug, restaurantName, now, readOnly, onViewProof, expanded, onToggle }: {
  order: Order; restaurantSlug: string; restaurantName: string; now: number | null; readOnly: boolean;
  onViewProof: (url: string) => void; expanded: boolean; onToggle: () => void;
}) {
  const [confirmNoProof, setConfirmNoProof] = useState(false);
  const border = urgencyBorder(order, now);
  const customerWaUrl = buildCustomerWaUrl(order, restaurantName);

  return (
    <article className={`card flex flex-col gap-0 ${border}`}>
      {/* Header — nowrap prevents status badge from dropping to a new line */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-3xl font-black tracking-tight">{formatOrderNumber(order.orderNumber)}</p>
          {/* Two fixed lines — time on one, relative on another — keeps card height uniform */}
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-stone-400 truncate">
            {order.createdAtLabel}
            {!expanded && order.paymentProofPath && (
              <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-semibold text-purple-700 shrink-0">📎</span>
            )}
          </p>
          {!readOnly && (
            <p className="text-xs text-stone-400 h-4 leading-4 truncate">
              {now ? relativeTime(order.createdAtMs, now) : " "}
            </p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${statusColors[order.status]}`}>
          {statusLabels[order.status]}
        </span>
      </div>

      <div className="mt-4 space-y-1.5 text-base">
        <p>
          <span className="text-stone-500">Cliente</span>{" "}
          <strong>{order.customer.name}</strong>
          {order.customer.favorite && <span className="ml-1" title="Cliente favorito">⭐</span>}
        </p>
        <div className="flex items-center gap-2">
          <p><span className="text-stone-500">Tel.</span> <strong>{order.customer.phone}</strong></p>
          {customerWaUrl && !readOnly && (
            <a
              aria-label={`WhatsApp con ${order.customer.name}`}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#25D366] text-white transition hover:bg-[#1ebe5d]"
              href={customerWaUrl}
              rel="noreferrer"
              target="_blank"
              title={`Contactar a ${order.customer.name} por WhatsApp`}
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </a>
          )}
        </div>
        {order.fulfillment === "pickup" ? (
          <p className="font-semibold text-brand-purple">🏪 Recoge en el restaurante</p>
        ) : (
          <p className="text-stone-700"><span className="text-stone-500">Dirección</span> {order.address}</p>
        )}
        <p>
          <span className="text-stone-500">Total</span> <strong>{order.totalLabel}</strong>
          {order.deliveryFee > 0 && <span className="text-sm text-stone-500"> (incluye domicilio {formatMoney(order.deliveryFee)})</span>}
        </p>
      </div>

      {/* Items — hidden in compact mode, visible when expanded */}
      {expanded ? (
        <div className="mt-4 space-y-2">
          {order.items[0]?.catalogItem ? (
            (() => {
              const byCategory = order.items.reduce<Record<string, typeof order.items>>((acc, item) => {
                (acc[item.catalogCategory] ??= []).push(item);
                return acc;
              }, {});
              return Object.entries(byCategory).map(([cat, items]) => (
                <div className="rounded-xl bg-stone-50 p-3" key={cat}>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-stone-400">{cat}</p>
                  {items.map(item => (
                    <div className="flex items-baseline justify-between gap-2 text-base" key={item.id}>
                      <span className="font-medium">{item.quantity} × {item.catalogItem}</span>
                      <span className="text-sm text-stone-500">{formatMoney(Number(item.unitPrice) * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              ));
            })()
          ) : (
            order.items.map((item, index) => (
              <div className="rounded-xl bg-stone-50 p-3" key={item.id}>
                {order.items.length > 1 && <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-400">Almuerzo {index + 1}</p>}
                <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-base">
                  <dt className="text-stone-500">Sopa</dt>      <dd className="font-medium">{parseItemName(item.soup)}</dd>
                  <dt className="text-stone-500">Proteína</dt>  <dd className="font-medium">{parseItemName(item.protein)}</dd>
                  <dt className="text-stone-500">Principio</dt> <dd className="font-medium">{parseItemName(item.side)}</dd>
                  <dt className="text-stone-500">Bebida</dt>    <dd className="font-medium">{parseItemName(item.drink)}</dd>
                </dl>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Compact: show item count summary + toggle button */
        <button
          className="mt-3 flex w-full items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-500 transition hover:bg-stone-100"
          onClick={onToggle}
          type="button"
        >
          <span>
            {order.items[0]?.catalogItem
              ? `${order.items.reduce((s, i) => s + i.quantity, 0)} producto${order.items.reduce((s, i) => s + i.quantity, 0) !== 1 ? "s" : ""}`
              : `${order.items.length} almuerzo${order.items.length !== 1 ? "s" : ""}`}
          </span>
          <span className="text-xs font-semibold text-brand-blue">Ver detalle ↓</span>
        </button>
      )}

      {/* Toggle button when expanded — same style as "Ver detalle" */}
      {expanded && (
        <button
          className="mt-2 flex w-full items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-500 transition hover:bg-stone-100"
          onClick={onToggle}
          type="button"
        >
          <span />
          <span className="text-xs font-semibold text-brand-blue">Ocultar detalle ↑</span>
        </button>
      )}

      {/* Proof section — only shown when expanded to keep compact height uniform */}
      {expanded && order.paymentProofPath && (
        <div className="mt-4 rounded-xl bg-purple-50 p-3">
          <p className="text-sm font-semibold text-purple-800">
            Comprobante recibido{order.paymentSubmittedAtLabel ? ` · ${order.paymentSubmittedAtLabel}` : ""}
          </p>
          <button className="button-secondary mt-2 border-purple-300 text-purple-800" onClick={() => onViewProof(order.paymentProofPath!)} type="button">
            Ver comprobante
          </button>
        </div>
      )}

      {/* ── Action buttons ───────────────────────────────────────────────
          Compact: 1 primary action only (keeps card height uniform).
          Expanded: all secondary actions become visible. */}
      {!readOnly && (
        <div className="mt-3 border-t border-stone-100 pt-3 space-y-2">

          {/* ── PRIMARY ACTION (always visible) ── */}
          {order.status !== "CANCELLED" && order.status !== "PAYMENT_CONFIRMED" && (
            <>
              {confirmNoProof && !order.paymentProofPath ? (
                <div className="rounded-xl bg-amber-50 p-3 text-sm">
                  <p className="font-semibold text-amber-900">⚠ El cliente no adjuntó comprobante</p>
                  <p className="mt-1 text-amber-800">¿Confirmar el pago de todas formas?</p>
                  <div className="mt-3 flex gap-2">
                    <ConfirmButton id={order.id} onCancel={() => setConfirmNoProof(false)} slug={restaurantSlug} />
                    <button className={`${NEUTRAL_BTN} text-sm`} onClick={() => setConfirmNoProof(false)} type="button">Cancelar</button>
                  </div>
                </div>
              ) : (
                order.status !== "PAYMENT_REJECTED" && (
                  <>
                    <button
                      className={`${order.paymentProofPath ? "button-primary" : "rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"} w-full`}
                      onClick={() => {
                        if (!order.paymentProofPath) { setConfirmNoProof(true); return; }
                        (document.getElementById(`confirm-form-${order.id}`) as HTMLFormElement | null)?.requestSubmit();
                      }}
                      type="button"
                    >
                      {order.paymentProofPath ? "Confirmar pago" : "⚠ Confirmar sin comprobante"}
                    </button>
                    <form id={`confirm-form-${order.id}`} action={updateOrderStatus} className="hidden">
                      <input name="id" type="hidden" value={order.id} />
                      <input name="slug" type="hidden" value={restaurantSlug} />
                      <input name="status" type="hidden" value="PAYMENT_CONFIRMED" />
                    </form>
                  </>
                )
              )}
            </>
          )}

          {/* ── SECONDARY ACTIONS (expanded only) ── */}
          {expanded && (
            <div className="flex flex-wrap gap-2">
              {/* Rejected: reactivate */}
              {order.status === "PAYMENT_REJECTED" && (
                <StatusButton id={order.id} slug={restaurantSlug} status="PAYMENT_REVIEW" secondary>↩ Reactivar pedido</StatusButton>
              )}
              {/* Has proof + not rejected: request new proof */}
              {order.paymentProofPath && order.status === "PAYMENT_REVIEW" && (
                <StatusButton id={order.id} slug={restaurantSlug} status="PAYMENT_REJECTED" secondary>Solicitar nuevo comprobante</StatusButton>
              )}
              {/* Cancel (all active statuses) */}
              {order.status !== "CANCELLED" && order.status !== "PAYMENT_CONFIRMED" && (
                <StatusButton id={order.id} slug={restaurantSlug} status="CANCELLED" secondary>Cancelar</StatusButton>
              )}
              {/* Confirmed: reactivate or cancel */}
              {order.status === "PAYMENT_CONFIRMED" && (
                <>
                  <StatusButton id={order.id} slug={restaurantSlug} status={order.paymentProofPath ? "PAYMENT_REVIEW" : "PAYMENT_PENDING"} secondary>↩ Reactivar pedido</StatusButton>
                  <StatusButton id={order.id} slug={restaurantSlug} status="CANCELLED" secondary>Cancelar pedido</StatusButton>
                </>
              )}
              {/* Cancelled: reactivate */}
              {order.status === "CANCELLED" && (
                <StatusButton id={order.id} slug={restaurantSlug} status={order.paymentProofPath ? "PAYMENT_REVIEW" : "PAYMENT_PENDING"} secondary>↩ Reactivar pedido</StatusButton>
              )}
            </div>
          )}

          {/* Compact: show reactivate for cancelled/confirmed (single small button) */}
          {!expanded && (order.status === "PAYMENT_CONFIRMED" || order.status === "CANCELLED") && (
            <StatusButton id={order.id} slug={restaurantSlug} status={order.paymentProofPath ? "PAYMENT_REVIEW" : "PAYMENT_PENDING"} secondary>
              ↩ Reactivar pedido
            </StatusButton>
          )}
          {!expanded && order.status === "PAYMENT_REJECTED" && (
            <StatusButton id={order.id} slug={restaurantSlug} status="PAYMENT_REVIEW" secondary>↩ Reactivar pedido</StatusButton>
          )}
        </div>
      )}
    </article>
  );
}

function ConfirmButton({ id, slug, onCancel }: { id: string; slug: string; onCancel: () => void }) {
  return (
    <form
      action={updateOrderStatus}
      onSubmit={() => onCancel()}
    >
      <input name="id" type="hidden" value={id} />
      <input name="slug" type="hidden" value={slug} />
      <input name="status" type="hidden" value="PAYMENT_CONFIRMED" />
      <button className="button-primary text-sm" type="submit">Sí, confirmar</button>
    </form>
  );
}

function StatusButton({ id, slug, status, secondary, children }: {
  id: string; slug: string; status: string; secondary?: boolean; children: React.ReactNode;
}) {
  return (
    <form action={updateOrderStatus}>
      <input name="id" type="hidden" value={id} />
      <input name="slug" type="hidden" value={slug} />
      <input name="status" type="hidden" value={status} />
      <button className={secondary ? NEUTRAL_BTN : "button-primary"}>{children}</button>
    </form>
  );
}
