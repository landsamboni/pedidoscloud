"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createOrder } from "@/app/actions";
import { formatMoney } from "@/lib/format";
import { formatSurcharge, parseItemName, parseSurcharge, SIN_SOPA } from "@/lib/menu";

type Lunch = { soup: string; protein: string; side: string; drink: string };

type Props = {
  restaurantSlug: string;
  basePrice: number;
  menu: { soups: string[]; proteins: string[]; sides: string[]; drinks: string[] };
  delivery: { mode: string; fee: number; note: string | null; allowPickup: boolean };
};

function firstLunch(menu: Props["menu"]): Lunch {
  return {
    soup: menu.soups[0] ?? SIN_SOPA,
    protein: menu.proteins[0] ?? "",
    side: menu.sides[0] ?? "",
    drink: menu.drinks[0] ?? "",
  };
}

function lunchTotal(basePrice: number, item: Lunch): number {
  return basePrice + parseSurcharge(item.soup) + parseSurcharge(item.protein) + parseSurcharge(item.side) + parseSurcharge(item.drink);
}

function validateName(value: string): string | null {
  const clean = value.trim();
  if (!clean) return "Escribe tu nombre y apellido.";
  if (clean.length < 5) return "El nombre debe tener al menos 5 caracteres.";
  if (clean.split(" ").filter(Boolean).length < 2) return "Incluye nombre y apellido completos.";
  return null;
}

function validatePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10) return "El teléfono debe tener 10 dígitos (ej. 3001234567).";
  if (!digits.startsWith("3")) return "Ingresa un celular colombiano válido (comienza con 3).";
  return null;
}

function validateAddress(value: string): string | null {
  const clean = value.trim();
  if (!clean) return "Escribe tu dirección de entrega.";
  if (clean.length < 10) return "La dirección debe ser más específica (mínimo 10 caracteres).";
  if (!/\d/.test(clean)) return "La dirección debe incluir un número (ej. Cra 5 #12-34, apto 301).";
  return null;
}

export function CustomerOrderForm({ restaurantSlug, basePrice, menu, delivery }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">("delivery");
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [items, setItems] = useState<Lunch[]>([firstLunch(menu)]);
  const [error, setError] = useState("");
  const [showFloatingTotal, setShowFloatingTotal] = useState(true);
  const [pending, startTransition] = useTransition();
  const finalTotalRef = useRef<HTMLElement>(null);
  const deliveryRef = useRef<HTMLElement>(null);
  const submittingRef = useRef(false);
  const isPickup = fulfillment === "pickup";
  const deliveryFee = !isPickup && delivery.mode === "fixed" ? delivery.fee : 0;
  const foodTotal = useMemo(() => items.reduce((sum, item) => sum + lunchTotal(basePrice, item), 0), [basePrice, items]);
  const total = foodTotal + deliveryFee;

  useEffect(() => {
    const finalTotal = finalTotalRef.current;
    if (!finalTotal) return;
    const observer = new IntersectionObserver(([entry]) => setShowFloatingTotal(!entry.isIntersecting), { threshold: 0.25 });
    observer.observe(finalTotal);
    return () => observer.disconnect();
  }, []);

  function resizeItems(quantity: number) {
    setItems((current) => Array.from({ length: quantity }, (_, index) => current[index] ?? firstLunch(menu)));
  }

  function updateItem(index: number, field: keyof Lunch, value: string) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function handlePhoneChange(value: string) {
    setPhone(value.replace(/\D/g, "").slice(0, 10));
  }

  function submit() {
    setError("");
    const ne = validateName(name);
    const pe = validatePhone(phone);
    const ae = isPickup ? null : validateAddress(address);
    setNameError(ne); setPhoneError(pe); setAddressError(ae);
    if (ne || pe || ae) { deliveryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (submittingRef.current) return;
    submittingRef.current = true;
    startTransition(async () => {
      try {
        const result = await createOrder({ restaurantSlug, name: name.trim(), phone, address: isPickup ? "" : address.trim(), items, fulfillment });
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
      <section className="card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">Cantidad de almuerzos</h2>
          <div className="flex shrink-0 items-center gap-3">
            <button aria-label="Quitar un almuerzo" className="h-12 w-12 rounded-xl border border-stone-300 bg-white text-2xl font-bold" disabled={items.length === 1} onClick={() => resizeItems(items.length - 1)} type="button">−</button>
            <span className="min-w-6 text-center text-2xl font-bold">{items.length}</span>
            <button aria-label="Agregar un almuerzo" className="h-12 w-12 rounded-xl bg-teal-600 text-2xl font-bold text-white" disabled={items.length === 6} onClick={() => resizeItems(items.length + 1)} type="button">+</button>
          </div>
        </div>
        <div className="mt-4 space-y-5">
          {items.map((item, index) => (
            <div className="overflow-hidden rounded-2xl border-2 border-teal-200 bg-white shadow-sm" key={index}>
              <div className="border-b border-teal-200 bg-teal-50 px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-bold uppercase tracking-wide text-teal-600">Almuerzo {index + 1} de {items.length}</p>
                  <p className="text-base font-bold text-teal-700">{formatMoney(lunchTotal(basePrice, item))}</p>
                </div>
              </div>
              <div className="space-y-5 p-4">
                {index > 0 && <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">Revisa las opciones de este almuerzo antes de continuar.</p>}
                <Option label="Sopa" options={menu.soups} value={item.soup} withSinSopa onChange={(value) => updateItem(index, "soup", value)} />
                <Option label="Proteína" options={menu.proteins} value={item.protein} onChange={(value) => updateItem(index, "protein", value)} />
                <Option label="Principio" options={menu.sides} value={item.side} onChange={(value) => updateItem(index, "side", value)} />
                <Option label="Bebida" options={menu.drinks} value={item.drink} onChange={(value) => updateItem(index, "drink", value)} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card scroll-mt-4 space-y-3" ref={deliveryRef}>
        <h2 className="text-2xl font-bold">{isPickup ? "Tus datos" : "Datos para la entrega"}</h2>

        {delivery.allowPickup && (
          <div className="grid grid-cols-2 gap-2">
            {(["delivery", "pickup"] as const).map((opt) => {
              const selected = fulfillment === opt;
              return (
                <button
                  aria-pressed={selected}
                  className={`min-h-12 rounded-xl border px-3 py-2 text-base font-semibold transition ${selected ? "border-teal-600 bg-teal-600 text-white" : "border-stone-300 bg-white text-stone-700 hover:border-teal-400"}`}
                  key={opt}
                  onClick={() => setFulfillment(opt)}
                  type="button"
                >
                  {opt === "delivery" ? "🛵 Domicilio" : "🏪 Recoger"}
                </button>
              );
            })}
          </div>
        )}

        <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600">
          {isPickup
            ? "Recoges tu pedido en el restaurante — sin costo de domicilio."
            : delivery.mode === "fixed"
            ? `Domicilio: ${formatMoney(delivery.fee)} (se suma al total).`
            : delivery.mode === "free"
            ? "Domicilio: ¡gratis!"
            : (delivery.note || "El domicilio se paga aparte; el restaurante lo coordina contigo.")}
        </p>

        <div>
          <input aria-describedby={nameError ? "name-error" : undefined} aria-invalid={!!nameError} className={`input text-base ${nameError ? "border-red-400 focus:border-red-400 focus:ring-red-100" : ""}`} placeholder="Nombre y Apellido" value={name} onBlur={() => setNameError(validateName(name))} onChange={(e) => { setName(e.target.value); if (nameError) setNameError(validateName(e.target.value)); }} />
          {nameError && <p className="mt-1 text-sm text-red-600" id="name-error">{nameError}</p>}
        </div>
        <div>
          <input aria-describedby={phoneError ? "phone-error" : undefined} aria-invalid={!!phoneError} className={`input text-base ${phoneError ? "border-red-400 focus:border-red-400 focus:ring-red-100" : ""}`} inputMode="tel" maxLength={10} placeholder="Teléfono celular (10 dígitos)" value={phone} onBlur={() => setPhoneError(validatePhone(phone))} onChange={(e) => { handlePhoneChange(e.target.value); if (phoneError) setPhoneError(validatePhone(e.target.value.replace(/\D/g, "").slice(0, 10))); }} />
          {phoneError && <p className="mt-1 text-sm text-red-600" id="phone-error">{phoneError}</p>}
        </div>
        {!isPickup && (
          <div>
            <textarea aria-describedby={addressError ? "address-error" : undefined} aria-invalid={!!addressError} className={`input min-h-24 text-base ${addressError ? "border-red-400 focus:border-red-400 focus:ring-red-100" : ""}`} placeholder="Dirección de entrega (ej. Cra 5 #12-34, apto 301)" value={address} onBlur={() => setAddressError(validateAddress(address))} onChange={(e) => { setAddress(e.target.value); if (addressError) setAddressError(validateAddress(e.target.value)); }} />
            {addressError && <p className="mt-1 text-sm text-red-600" id="address-error">{addressError}</p>}
          </div>
        )}
      </section>

      <section className="card" ref={finalTotalRef}>
        <div className="space-y-1 text-sm text-stone-600">
          <div className="flex items-center justify-between">
            <span>Comida ({items.length} {items.length === 1 ? "almuerzo" : "almuerzos"})</span>
            <span>{formatMoney(foodTotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Domicilio</span>
            <span>
              {isPickup ? "Recoger en restaurante" : delivery.mode === "fixed" ? formatMoney(delivery.fee) : delivery.mode === "free" ? "Gratis" : "Se paga aparte"}
            </span>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-stone-200 pt-2 text-xl font-bold">
          <span>Total a pagar</span>
          <span>{formatMoney(total)}</span>
        </div>
        {!isPickup && delivery.mode === "separate" && (
          <p className="mt-1 text-xs text-stone-400">El domicilio no está incluido; se paga/coordina aparte con el restaurante.</p>
        )}
        {error && <p className="mt-3 text-base font-medium text-red-700">{error}</p>}
        <button className="button-primary mt-4 w-full py-3 text-base" disabled={pending} onClick={submit}>
          {pending ? "Confirmando..." : "Confirmar pedido"}
        </button>
      </section>

      {showFloatingTotal && (
        <aside className="fixed inset-x-0 bottom-0 z-20 border-t border-teal-700 bg-teal-600 px-4 py-3 text-white shadow-[0_-6px_18px_rgba(0,0,0,0.16)] sm:hidden">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{items.length} {items.length === 1 ? "almuerzo" : "almuerzos"}</p>
              <p className="text-xs text-teal-100">Total de tu pedido</p>
            </div>
            <p className="text-2xl font-bold">{formatMoney(total)}</p>
          </div>
        </aside>
      )}
    </div>
  );
}

function Option({ label, options, value, onChange, withSinSopa = false }: {
  label: string; options: string[]; value: string; onChange: (value: string) => void; withSinSopa?: boolean;
}) {
  const allOptions = withSinSopa ? [SIN_SOPA, ...options] : options;
  return (
    <fieldset>
      <legend className="text-lg font-bold text-stone-800">{label}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {allOptions.map((raw) => {
          const name = parseItemName(raw);
          const surcharge = parseSurcharge(raw);
          const selected = raw === value;
          const isSinSopa = raw === SIN_SOPA;
          return (
            <button
              aria-pressed={selected}
              className={`min-h-14 rounded-xl border px-4 py-3 text-left text-base font-semibold transition ${
                selected
                  ? "border-teal-600 bg-teal-600 text-white ring-2 ring-teal-200"
                  : isSinSopa
                  ? "border-dashed border-stone-300 bg-white text-stone-500 hover:border-teal-400"
                  : "border-stone-300 bg-white text-stone-800 hover:border-teal-400"
              }`}
              key={raw}
              onClick={() => onChange(raw)}
              type="button"
            >
              <span>{selected ? "✓ " : ""}{name}</span>
              {surcharge > 0 && (
                <span className={`ml-1.5 text-sm font-medium ${selected ? "text-teal-100" : "text-amber-600"}`}>
                  {formatSurcharge(surcharge)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
