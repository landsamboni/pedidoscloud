"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatSurcharge, parseItemName, parseSurcharge } from "@/lib/menu";

const FIELDS = [
  { name: "soups", label: "Sopas" },
  { name: "proteins", label: "Proteínas" },
  { name: "sides", label: "Principios" },
  { name: "drinks", label: "Bebidas" },
] as const;

type ReviewItem = { raw: string; name: string; surcharge: number };
type ReviewGroup = { label: string; items: ReviewItem[] };

/**
 * The four menu editors, kept the SAME height for a symmetric layout while still
 * showing all options without an internal scrollbar (each textarea grows to fit
 * its content, then all are set to the tallest one's height). Includes a
 * "Revisar menú" button that opens a read-only preview of every option exactly
 * as customers will see it, so the operator can proofread before publishing.
 */
export function MenuFields({ values }: { values: Partial<Record<(typeof FIELDS)[number]["name"], string>> }) {
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const [review, setReview] = useState<ReviewGroup[] | null>(null);

  const equalize = useCallback(() => {
    const els = refs.current.filter(Boolean) as HTMLTextAreaElement[];
    if (!els.length) return;
    let max = 0;
    for (const el of els) {
      el.style.height = "auto";
      max = Math.max(max, el.scrollHeight);
    }
    for (const el of els) el.style.height = `${max}px`;
  }, []);

  useEffect(() => {
    equalize();
    const raf = requestAnimationFrame(equalize);
    return () => cancelAnimationFrame(raf);
  }, [equalize]);

  function openReview() {
    setReview(
      FIELDS.map((f, i) => {
        const text = refs.current[i]?.value ?? "";
        const items = text
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((raw) => ({ raw, name: parseItemName(raw), surcharge: parseSurcharge(raw) }));
        return { label: f.label, items };
      }),
    );
  }

  return (
    <>
      {FIELDS.map((f, i) => (
        <label className="text-sm font-medium text-stone-700" key={f.name}>
          {f.label}{" "}
          <span className="font-normal text-stone-400">
            (una por línea · precio extra: <code className="rounded bg-stone-100 px-1 text-xs">Costilla BBQ +3000</code>)
          </span>
          <textarea
            className="input mt-1 min-h-44 resize-none overflow-hidden font-mono text-sm leading-relaxed"
            defaultValue={values[f.name] ?? ""}
            lang="es"
            name={f.name}
            onFocus={equalize}
            onInput={equalize}
            ref={(el) => { refs.current[i] = el; }}
            required
            spellCheck
          />
        </label>
      ))}

      <button className="button-secondary sm:col-span-2" onClick={openReview} type="button">
        Revisar menú
      </button>

      {review && <ReviewModal groups={review} onClose={() => setReview(null)} />}
    </>
  );
}

function ReviewModal({ groups, onClose }: { groups: ReviewGroup[]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const totalItems = groups.reduce((n, g) => n + g.items.length, 0);
  const emptyGroups = groups.filter((g) => g.items.length === 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-stone-200 px-5 py-4">
          <div>
            <p className="text-lg font-bold text-stone-900">Revisar menú de hoy</p>
            <p className="mt-0.5 text-sm text-stone-500">Así lo verán tus clientes · {totalItems} opciones</p>
          </div>
          <button
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-4">
          {emptyGroups.length > 0 && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              ⚠ Falta llenar: {emptyGroups.map((g) => g.label).join(", ")}. No podrás publicar hasta completar cada categoría.
            </p>
          )}
          {groups.map((g) => (
            <div key={g.label}>
              <p className="mb-1.5 text-sm font-bold uppercase tracking-wider text-teal-700">{g.label}</p>
              {g.items.length === 0 ? (
                <p className="text-sm italic text-stone-400">Sin opciones.</p>
              ) : (
                <ul className="space-y-1">
                  {g.items.map((it, idx) => (
                    <li className="flex items-baseline justify-between gap-3 border-b border-stone-100 pb-1 text-stone-800" key={idx}>
                      <span>{it.name}</span>
                      {it.surcharge > 0 && (
                        <span className="shrink-0 text-sm font-medium text-amber-600">{formatSurcharge(it.surcharge)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-stone-200 px-5 py-4 sm:flex-row-reverse">
          <button className="button-primary sm:flex-1" disabled={emptyGroups.length > 0} type="submit">
            Publicar menú de hoy
          </button>
          <button className="button-secondary sm:flex-1" onClick={onClose} type="button">
            Seguir editando
          </button>
        </div>
      </div>
    </div>
  );
}
