"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { createCatalogOrder } from "@/app/actions";
import { formatMoney } from "@/lib/format";

type CatalogItem = { id: string; name: string; price: number };
type CatalogCategory = { id: string; name: string; items: CatalogItem[] };

type Props = {
  restaurantSlug: string;
  orderUnitLabel: string; // e.g. "pedido", "almuerzo", "caja"
  categories: CatalogCategory[];
  delivery: { mode: string; fee: number; note: string | null; allowPickup: boolean };
};

function validateFullName(v: string) {
  const c = v.trim();
  if (!c) return "Escribe tu nombre y apellido.";
  if (c.length < 5) return "El nombre debe tener al menos 5 caracteres.";
  if (c.split(" ").filter(Boolean).length < 2) return "Incluye nombre y apellido completos.";
  return null;
}
function validatePhone(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length !== 10) return "El teléfono debe tener 10 dígitos.";
  if (!d.startsWith("3")) return "Ingresa un celular colombiano válido (comienza con 3).";
  return null;
}
function validateAddress(v: string) {
  const c = v.trim();
  if (!c) return "Escribe tu dirección.";
  if (c.length < 10) return "La dirección debe ser más específica.";
  if (!/\d/.test(c)) return "La dirección debe incluir un número.";
  return null;
}

export function CatalogOrderForm({ restaurantSlug, orderUnitLabel, categories, delivery }: Props) {
  const [quantities, setQuantities] = useState<Record<string, number>>({}); // itemId -> qty
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">("delivery");
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const deliveryRef = useRef<HTMLElement>(null);
  const submittingRef = useRef(false);

  const isPickup = fulfillment === "pickup";
  const deliveryFee = !isPickup && delivery.mode === "fixed" ? delivery.fee : 0;

  const itemsTotal = useMemo(() => {
    return categories.flatMap(c => c.items).reduce((sum, item) => {
      return sum + (quantities[item.id] ?? 0) * item.price;
    }, 0);
  }, [categories, quantities]);
  const total = itemsTotal + deliveryFee;
  const totalItems = Object.values(quantities).reduce((s, q) => s + q, 0);

  function setQty(itemId: string, delta: number) {
    setQuantities(prev => {
      const current = prev[itemId] ?? 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: next };
    });
  }

  function submit() {
    setError("");
    const ne = validateFullName(name);
    const pe = validatePhone(phone);
    const ae = isPickup ? null : validateAddress(address);
    setNameError(ne); setPhoneError(pe); setAddressError(ae);
    if (ne || pe || ae) { deliveryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (totalItems === 0) { setError("Agrega al menos un producto a tu pedido."); return; }
    if (submittingRef.current) return;
    submittingRef.current = true;

    const items = categories.flatMap(cat =>
      cat.items
        .filter(item => (quantities[item.id] ?? 0) > 0)
        .map(item => ({
          categoryName: cat.name,
          itemName: item.name,
          unitPrice: item.price,
          quantity: quantities[item.id] ?? 0,
        }))
    );

    startTransition(async () => {
      try {
        const result = await createCatalogOrder({
          restaurantSlug,
          name: name.trim(),
          phone,
          address: isPickup ? "" : address.trim(),
          fulfillment,
          items,
        });
        if (!result.publicToken) throw new Error("No pudimos abrir el pago de tu pedido.");
        window.location.assign(`/r/${restaurantSlug}/orders/${result.publicToken}`);
      } catch (cause) {
        submittingRef.current = false;
        setError(cause instanceof Error ? cause.message : "No pudimos crear tu pedido.");
      }
    });
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Product selection */}
      {categories.map(cat => (
        <section className="card" key={cat.id}>
          <h2 className="text-xl font-bold mb-3">{cat.name}</h2>
          <div className="space-y-2">
            {cat.items.map(item => {
              const qty = quantities[item.id] ?? 0;
              return (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-stone-900 truncate">{item.name}</p>
                    <p className="text-sm font-semibold text-brand-blue">{formatMoney(item.price)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      aria-label="Quitar uno"
                      className={`h-9 w-9 rounded-xl border text-xl font-bold transition ${qty > 0 ? "border-brand-blue bg-brand-blue text-white" : "border-stone-300 bg-white text-stone-400"}`}
                      disabled={qty === 0}
                      onClick={() => setQty(item.id, -1)}
                      type="button"
                    >−</button>
                    <span className="min-w-[1.5rem] text-center text-lg font-bold">{qty}</span>
                    <button
                      aria-label="Agregar uno"
                      className="h-9 w-9 rounded-xl bg-brand-blue text-xl font-bold text-white transition hover:bg-teal-700"
                      onClick={() => setQty(item.id, 1)}
                      type="button"
                    >+</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Delivery / pickup toggle + customer data */}
      <section className="card scroll-mt-4 space-y-3" ref={deliveryRef}>
        <h2 className="text-2xl font-bold">{isPickup ? "Tus datos" : "Datos para la entrega"}</h2>

        {delivery.allowPickup && (
          <div className="grid grid-cols-2 gap-2">
            {(["delivery", "pickup"] as const).map(opt => (
              <button
                aria-pressed={fulfillment === opt}
                className={`min-h-12 rounded-xl border px-3 py-2 text-base font-semibold transition ${fulfillment === opt ? "border-brand-blue bg-brand-blue text-white" : "border-stone-300 bg-white text-stone-700 hover:border-brand-blue/40"}`}
                key={opt}
                onClick={() => setFulfillment(opt)}
                type="button"
              >
                {opt === "delivery" ? "🛵 Domicilio" : "🏪 Recoger"}
              </button>
            ))}
          </div>
        )}

        <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600">
          {isPickup
            ? "Recoges tu pedido en el restaurante — sin costo de domicilio."
            : delivery.mode === "fixed"
            ? `Domicilio: ${formatMoney(delivery.fee)} (se suma al total).`
            : delivery.mode === "free"
            ? "Domicilio: ¡gratis!"
            : "El valor del domicilio lo pagas en tu casa al recibir el pedido."}
        </p>

        <div>
          <input
            aria-invalid={!!nameError}
            className={`input text-base ${nameError ? "border-red-400" : ""}`}
            onBlur={() => setNameError(validateFullName(name))}
            onChange={e => { setName(e.target.value); if (nameError) setNameError(validateFullName(e.target.value)); }}
            placeholder="Nombre y Apellido"
            value={name}
          />
          {nameError && <p className="mt-1 text-sm text-red-600">{nameError}</p>}
        </div>
        <div>
          <input
            aria-invalid={!!phoneError}
            className={`input text-base ${phoneError ? "border-red-400" : ""}`}
            inputMode="tel"
            maxLength={10}
            onBlur={() => setPhoneError(validatePhone(phone))}
            onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 10); setPhone(v); if (phoneError) setPhoneError(validatePhone(v)); }}
            placeholder="Teléfono celular (10 dígitos)"
            value={phone}
          />
          {phoneError && <p className="mt-1 text-sm text-red-600">{phoneError}</p>}
        </div>
        {!isPickup && (
          <div>
            <textarea
              aria-invalid={!!addressError}
              className={`input min-h-24 text-base ${addressError ? "border-red-400" : ""}`}
              onBlur={() => setAddressError(validateAddress(address))}
              onChange={e => { setAddress(e.target.value); if (addressError) setAddressError(validateAddress(e.target.value)); }}
              placeholder="Dirección de entrega (ej. Cra 5 #12-34, apto 301)"
              value={address}
            />
            {addressError && <p className="mt-1 text-sm text-red-600">{addressError}</p>}
          </div>
        )}
      </section>

      {/* Total + confirm */}
      <section className="card">
        {totalItems > 0 && (
          <div className="space-y-1 text-sm text-stone-600 mb-2">
            {categories.flatMap(cat =>
              cat.items
                .filter(item => (quantities[item.id] ?? 0) > 0)
                .map(item => (
                  <div key={item.id} className="flex justify-between">
                    <span>{quantities[item.id]} × {item.name}</span>
                    <span>{formatMoney((quantities[item.id] ?? 0) * item.price)}</span>
                  </div>
                ))
            )}
            {deliveryFee > 0 && (
              <div className="flex justify-between">
                <span>Domicilio</span>
                <span>{formatMoney(deliveryFee)}</span>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-stone-200 pt-2 text-xl font-bold">
          <span>Total a pagar</span>
          <span>{formatMoney(total)}</span>
        </div>
        {totalItems === 0 && <p className="mt-1 text-sm text-stone-400">Agrega productos de arriba para ver el total.</p>}
        {error && <p className="mt-3 text-base font-medium text-red-700">{error}</p>}
        <button className="button-primary mt-4 w-full py-3 text-base" disabled={pending || totalItems === 0} onClick={submit}>
          {pending ? "Confirmando..." : "Confirmar pedido"}
        </button>
      </section>

      {/* Floating total on mobile */}
      {totalItems > 0 && (
        <aside className="fixed inset-x-0 bottom-0 z-20 border-t border-brand-blue bg-brand-blue px-4 py-3 text-white shadow-lg sm:hidden">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{totalItems} {totalItems === 1 ? orderUnitLabel : "productos"}</p>
              <p className="text-xs text-blue-100">Total de tu pedido</p>
            </div>
            <p className="text-2xl font-bold">{formatMoney(total)}</p>
          </div>
        </aside>
      )}
    </div>
  );
}
