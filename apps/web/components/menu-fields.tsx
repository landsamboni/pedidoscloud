"use client";

import { useCallback, useEffect, useRef } from "react";

export const MENU_FIELDS = [
  { name: "soups", label: "Sopas" },
  { name: "proteins", label: "Proteínas" },
  { name: "sides", label: "Principios" },
  { name: "drinks", label: "Bebidas" },
] as const;

/**
 * The four menu editors, kept the SAME height for a symmetric layout while still
 * showing all options without an internal scrollbar (each textarea grows to fit
 * its content, then all are set to the tallest one's height).
 */
export function MenuFields({ values }: { values: Partial<Record<(typeof MENU_FIELDS)[number]["name"], string>> }) {
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);

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

  return (
    <>
      {MENU_FIELDS.map((f, i) => (
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
    </>
  );
}
