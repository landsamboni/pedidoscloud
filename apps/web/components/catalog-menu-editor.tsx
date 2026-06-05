"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { unpublishCatalogMenu, updateCatalogMenu, updateMenuItemDetails, type CatalogCategory, type CatalogMenuState } from "@/app/actions";
import { FeedbackForm, FileInput, SubmitButton, Toast } from "@/components/feedback-form";
import { resolveFileUrl } from "@/lib/file-url";
import { formatMoney } from "@/lib/format";

const INITIAL: CatalogMenuState = { ok: false, message: "", ts: 0 };

type Props = {
  restaurantId: string;
  returnPath: string;
  publishedToday: boolean;
  initialCategories: CatalogCategory[];
};

export function CatalogMenuEditor({ restaurantId, returnPath, publishedToday, initialCategories }: Props) {
  const [state, action, pending] = useActionState(updateCatalogMenu, INITIAL);
  const [unpubState, unpubAction] = useActionState(unpublishCatalogMenu, INITIAL);
  const [categories, setCategories] = useState<CatalogCategory[]>(
    initialCategories.length > 0 ? initialCategories : [{ name: "", items: [{ name: "", price: 0 }] }]
  );
  const [confirmUnpub, setConfirmUnpub] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaveTs = useRef(0);
  const lastUnpubTs = useRef(0);

  function showToast(msg: string) {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3500);
  }

  useEffect(() => {
    if (state.ok && state.ts !== lastSaveTs.current) {
      lastSaveTs.current = state.ts;
      showToast(state.message);
    }
  }, [state]);

  useEffect(() => {
    if (unpubState.ok && unpubState.ts !== lastUnpubTs.current) {
      lastUnpubTs.current = unpubState.ts;
      setConfirmUnpub(false);
      showToast(unpubState.message);
    }
  }, [unpubState]);

  // ---- Category helpers ----
  function addCategory() {
    setCategories(prev => [...prev, { name: "", items: [{ name: "", price: 0 }] }]);
  }
  function removeCategory(ci: number) {
    setCategories(prev => prev.filter((_, i) => i !== ci));
  }
  function setCategoryName(ci: number, name: string) {
    setCategories(prev => prev.map((c, i) => i === ci ? { ...c, name } : c));
  }

  // ---- Item helpers ----
  function addItem(ci: number) {
    setCategories(prev => prev.map((c, i) => i === ci ? { ...c, items: [...c.items, { name: "", price: 0 }] } : c));
  }
  function removeItem(ci: number, ii: number) {
    setCategories(prev => prev.map((c, i) => i === ci ? { ...c, items: c.items.filter((_, j) => j !== ii) } : c));
  }
  function setItemField(ci: number, ii: number, field: "name" | "price", value: string | number) {
    setCategories(prev => prev.map((c, i) => i !== ci ? c : {
      ...c,
      items: c.items.map((item, j) => j !== ii ? item : { ...item, [field]: field === "price" ? Number(value) : value }),
    }));
  }

  const totalItems = categories.reduce((n, c) => n + c.items.length, 0);

  return (
    <>
      <form
        action={action}
        onSubmit={(e) => {
          // Serialize categories to JSON hidden field before submitting.
          const form = e.currentTarget;
          (form.querySelector('input[name="categories"]') as HTMLInputElement).value = JSON.stringify(categories);
        }}
        className="space-y-4 mt-4"
      >
        <input name="restaurantId" type="hidden" value={restaurantId} />
        <input name="returnPath" type="hidden" value={returnPath} />
        <input name="categories" type="hidden" value="" />

        {publishedToday ? (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            ✓ El menú de hoy ya está publicado. Edítalo y guarda para actualizarlo.
          </p>
        ) : (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Tus clientes <strong>no</strong> ven este menú todavía. Ajusta y pulsa <strong>Publicar menú de hoy</strong>.
          </p>
        )}

        <div className="space-y-4">
          {categories.map((cat, ci) => (
            <div key={ci} className="rounded-xl border-2 border-brand-blue/20 bg-white p-4">
              {/* Category header */}
              <div className="flex items-center gap-2 mb-3">
                <input
                  className="input flex-1 font-semibold"
                  onChange={e => setCategoryName(ci, e.target.value)}
                  placeholder="Nombre de la categoría (ej. Pasteles, Bebidas)"
                  required
                  value={cat.name}
                />
                {categories.length > 1 && (
                  <button
                    className="button-danger shrink-0 px-3 py-2 text-sm"
                    onClick={() => removeCategory(ci)}
                    type="button"
                  >
                    Quitar
                  </button>
                )}
              </div>

              {/* Items */}
              <div className="space-y-3">
                {cat.items.map((item, ii) => (
                  <div key={ii} className="rounded-xl border border-stone-100 bg-stone-50 p-2">
                    <div className="flex items-center gap-2">
                      <input
                        className="input flex-1 text-sm bg-white"
                        onChange={e => setItemField(ci, ii, "name", e.target.value)}
                        placeholder="Nombre del producto"
                        required
                        value={item.name}
                      />
                      <div className="relative w-32 shrink-0">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">$</span>
                        <input
                          className="input pl-6 text-sm bg-white"
                          inputMode="numeric"
                          min="0"
                          onChange={e => setItemField(ci, ii, "price", e.target.value)}
                          placeholder="0"
                          required
                          step="1"
                          type="number"
                          value={item.price || ""}
                        />
                      </div>
                      {cat.items.length > 1 && (
                        <button
                          className="shrink-0 rounded-lg px-2 py-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 transition"
                          onClick={() => removeItem(ci, ii)}
                          title="Quitar producto"
                          type="button"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {/* Details panel — only for saved items (have an id) */}
                    {item.id && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-medium text-brand-purple hover:underline">
                          {item.description || item.imagePath ? "✓ Tiene descripción/foto · Editar" : "+ Agregar descripción y foto (opcional)"}
                        </summary>
                        <FeedbackForm action={updateMenuItemDetails} className="mt-2 grid gap-2">
                          <input name="itemId" type="hidden" value={item.id} />
                          <input name="returnPath" type="hidden" value={returnPath} />
                          <label className="text-xs font-medium text-stone-600">
                            Descripción
                            <textarea
                              className="input mt-1 min-h-20 resize-none text-xs"
                              defaultValue={item.description ?? ""}
                              maxLength={300}
                              name="description"
                              placeholder="Ingredientes, tamaño, sabor especial, etc."
                            />
                          </label>
                          <label className="text-xs font-medium text-stone-600">
                            Foto del producto <span className="font-normal text-stone-400">(JPG/PNG/WEBP, opcional)</span>
                            {item.imagePath && (
                              <div className="mt-1 flex items-center gap-2">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img alt="foto" className="h-12 w-12 rounded-lg border object-cover" src={resolveFileUrl(item.imagePath) ?? ""} />
                                <span className="text-xs text-teal-600">Foto configurada. Sube otra para reemplazarla.</span>
                              </div>
                            )}
                            <FileInput accept="image/jpeg,image/png,image/webp" className="input mt-1 text-xs" name="image" type="file" />
                          </label>
                          <SubmitButton className="button-secondary text-xs" pendingLabel="Guardando…">Guardar descripción y foto</SubmitButton>
                        </FeedbackForm>
                      </details>
                    )}
                  </div>
                ))}
              </div>

              <button
                className="mt-2 text-sm font-medium text-brand-blue hover:underline"
                onClick={() => addItem(ci)}
                type="button"
              >
                + Agregar producto
              </button>
            </div>
          ))}
        </div>

        <button
          className="button-secondary w-full"
          onClick={addCategory}
          type="button"
        >
          + Agregar categoría
        </button>

        <p className="text-xs text-stone-400 text-center">{categories.length} categorías · {totalItems} productos</p>

        {!state.ok && state.message && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{state.message}</p>
        )}

        <SubmitButton className="button-primary w-full py-3 text-base" pendingLabel="Guardando…">
          {publishedToday ? "Guardar menú" : "Publicar menú de hoy"}
        </SubmitButton>
      </form>

      {/* Unpublish */}
      {publishedToday && (
        <div className="mt-3 border-t border-stone-100 pt-3">
          {!confirmUnpub ? (
            <button className="button-danger" onClick={() => setConfirmUnpub(true)} type="button">
              Despublicar menú (pausar pedidos)
            </button>
          ) : (
            <form action={unpubAction} className="flex flex-col gap-2 rounded-xl bg-brand-pink/5 p-3 sm:flex-row sm:items-center">
              <input name="restaurantId" type="hidden" value={restaurantId} />
              <input name="returnPath" type="hidden" value={returnPath} />
              <p className="text-sm text-stone-700 sm:flex-1">¿Quitar el menú de hoy? Los clientes no podrán pedir hasta que vuelvas a publicar.</p>
              <div className="flex gap-2">
                <SubmitButton className="rounded-xl bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:brightness-95" pendingLabel="Despublicando…">
                  Sí, despublicar
                </SubmitButton>
                <button className="button-secondary text-sm" onClick={() => setConfirmUnpub(false)} type="button">Cancelar</button>
              </div>
            </form>
          )}
        </div>
      )}

      {toastMsg && <Toast message={toastMsg} />}
    </>
  );
}
