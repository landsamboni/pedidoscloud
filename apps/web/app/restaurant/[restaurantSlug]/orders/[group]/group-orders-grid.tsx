"use client";

import { useEffect, useState } from "react";
import { OrderCard, type Order } from "@/components/restaurant-orders";

export function GroupOrdersGrid({
  orders,
  restaurantSlug,
  restaurantName,
}: {
  orders: Order[];
  restaurantSlug: string;
  restaurantName: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  function isExpanded(id: string) {
    return expandAll || expandedCards.has(id);
  }

  function toggle(id: string) {
    if (expandAll) {
      setExpandAll(false);
      const all = new Set(orders.map((o) => o.id));
      all.delete(id);
      setExpandedCards(all);
    } else {
      setExpandedCards((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  }

  return (
    <>
      {/* Toolbar */}
      <div className="mb-3 flex justify-end">
        {expandAll ? (
          <button
            className="text-xs font-semibold text-stone-500 hover:text-stone-700"
            onClick={() => { setExpandAll(false); setExpandedCards(new Set()); }}
            type="button"
          >
            ↑ Colapsar todo
          </button>
        ) : (
          <button
            className="text-xs font-semibold text-brand-blue hover:underline"
            onClick={() => { setExpandAll(true); setExpandedCards(new Set()); }}
            type="button"
          >
            ↓ Expandir todo
          </button>
        )}
      </div>

      {/* Horizontal grid — fills the full screen width */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 items-start">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            expanded={isExpanded(order.id)}
            now={now}
            onToggle={() => toggle(order.id)}
            onViewProof={setProofUrl}
            order={order}
            readOnly={false}
            restaurantName={restaurantName}
            restaurantSlug={restaurantSlug}
          />
        ))}
      </div>

      {/* Proof modal */}
      {proofUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setProofUrl(null)}
        >
          <div
            className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-5 py-4">
              <p className="font-semibold">Comprobante de pago</p>
              <div className="flex items-center gap-3">
                <a className="text-sm font-medium text-teal-600 hover:underline" download href={proofUrl}>
                  Descargar
                </a>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"
                  onClick={() => setProofUrl(null)}
                  type="button"
                >
                  ✕
                </button>
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
