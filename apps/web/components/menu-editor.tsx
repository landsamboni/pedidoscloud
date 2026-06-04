"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { unpublishTodayMenu, updateTodayMenu, type MenuFormState } from "@/app/actions";
import { MENU_FIELDS, MenuFields } from "@/components/menu-fields";
import { SubmitButton, Toast } from "@/components/feedback-form";
import { formatSurcharge, parseItemName, parseSurcharge } from "@/lib/menu";

type ReviewGroup = { label: string; items: { name: string; surcharge: string }[] };

const INITIAL: MenuFormState = { ok: false, message: "", ts: 0 };

/**
 * Today's menu editor: the form (via useActionState so we can show feedback
 * without navigating away), a "Revisar menú" preview modal, and a floating
 * confirmation toast on save/publish.
 */
export function MenuEditor({
  restaurantId,
  returnPath,
  menuPublishedToday,
  hasTemplate,
  values,
}: {
  restaurantId: string;
  returnPath: string;
  menuPublishedToday: boolean;
  hasTemplate: boolean;
  values: Partial<Record<(typeof MENU_FIELDS)[number]["name"], string>>;
}) {
  const [state, action, pending] = useActionState(updateTodayMenu, INITIAL);
  const [unpubState, unpubAction] = useActionState(unpublishTodayMenu, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const [review, setReview] = useState<ReviewGroup[] | null>(null);
  const [confirmUnpub, setConfirmUnpub] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaveTs = useRef(0);
  const lastUnpubTs = useRef(0);

  function showToast(message: string) {
    setToastMsg(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3500);
  }

  // Successful save: close the review modal and show the toast.
  useEffect(() => {
    if (state.ok && state.ts !== lastSaveTs.current) {
      lastSaveTs.current = state.ts;
      setReview(null);
      showToast(state.message);
    }
  }, [state]);

  // Successful unpublish: close the confirm and show the toast.
  useEffect(() => {
    if (unpubState.ok && unpubState.ts !== lastUnpubTs.current) {
      lastUnpubTs.current = unpubState.ts;
      setConfirmUnpub(false);
      showToast(unpubState.message);
    }
  }, [unpubState]);

  useEffect(() => {
    if (!review) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setReview(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [review]);

  function openReview() {
    const fd = new FormData(formRef.current!);
    setReview(
      MENU_FIELDS.map((f) => ({
        label: f.label,
        items: String(fd.get(f.name) ?? "")
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .map((raw) => {
            const s = parseSurcharge(raw);
            return { name: parseItemName(raw), surcharge: s > 0 ? formatSurcharge(s) : "" };
          }),
      })),
    );
  }

  const emptyGroups = review?.filter((g) => g.items.length === 0) ?? [];

  return (
    <>
      <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2" ref={formRef}>
        <input name="restaurantId" type="hidden" value={restaurantId} />
        <input name="returnPath" type="hidden" value={returnPath} />

        {menuPublishedToday ? (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 sm:col-span-2">
            ✓ El menú de hoy ya está publicado y visible para tus clientes. Edítalo y guarda para actualizarlo.
          </p>
        ) : hasTemplate ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 sm:col-span-2">
            Estás viendo tu <strong>último menú</strong> como base. Tus clientes <strong>no</strong> lo ven todavía: ajusta lo que cambie hoy y pulsa <strong>Publicar menú de hoy</strong>.
          </p>
        ) : (
          <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600 sm:col-span-2">
            Aún no hay menú para hoy. Escríbelo y pulsa <strong>Publicar menú de hoy</strong>.
          </p>
        )}

        <MenuFields values={values} />

        {!state.ok && state.message && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 sm:col-span-2">{state.message}</p>
        )}

        <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row-reverse">
          <button className="button-primary sm:flex-1" disabled={pending} type="submit">
            {pending ? "Guardando…" : menuPublishedToday ? "Guardar menú" : "Publicar menú de hoy"}
          </button>
          <button className="button-secondary sm:flex-1" onClick={openReview} type="button">
            Revisar menú
          </button>
        </div>
      </form>

      {/* Unpublish — pause customer orders immediately */}
      {menuPublishedToday && (
        <div className="mt-3 border-t border-stone-100 pt-3">
          {!confirmUnpub ? (
            <button className="button-danger" onClick={() => setConfirmUnpub(true)} type="button">
              Despublicar menú (pausar pedidos)
            </button>
          ) : (
            <form action={unpubAction} className="flex flex-col gap-2 rounded-xl bg-brand-pink/5 p-3 sm:flex-row sm:items-center">
              <input name="restaurantId" type="hidden" value={restaurantId} />
              <input name="returnPath" type="hidden" value={returnPath} />
              <p className="text-sm text-stone-700 sm:flex-1">
                ¿Quitar el menú de hoy? Tus clientes verán “preparando el menú” y no podrán pedir hasta que vuelvas a publicar.
              </p>
              <div className="flex gap-2">
                <SubmitButton className="rounded-xl bg-brand-pink px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95" pendingLabel="Despublicando…">
                  Sí, despublicar
                </SubmitButton>
                <button className="button-secondary text-sm" onClick={() => setConfirmUnpub(false)} type="button">Cancelar</button>
              </div>
            </form>
          )}
        </div>
      )}

      {review && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setReview(null)}>
          <div className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-stone-200 px-5 py-4">
              <div>
                <p className="text-lg font-bold text-stone-900">Revisar menú de hoy</p>
                <p className="mt-0.5 text-sm text-stone-500">Así lo verán tus clientes</p>
              </div>
              <button aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100" onClick={() => setReview(null)} type="button">✕</button>
            </div>
            <div className="space-y-5 overflow-y-auto px-5 py-4">
              {emptyGroups.length > 0 && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  ⚠ Falta llenar: {emptyGroups.map((g) => g.label).join(", ")}.
                </p>
              )}
              {review.map((g) => (
                <div key={g.label}>
                  <p className="mb-1.5 text-sm font-bold uppercase tracking-wider text-teal-700">{g.label}</p>
                  {g.items.length === 0 ? (
                    <p className="text-sm italic text-stone-400">Sin opciones.</p>
                  ) : (
                    <ul className="space-y-1">
                      {g.items.map((it, idx) => (
                        <li className="flex items-baseline justify-between gap-3 border-b border-stone-100 pb-1 text-stone-800" key={idx}>
                          <span>{it.name}</span>
                          {it.surcharge && <span className="shrink-0 text-sm font-medium text-amber-600">{it.surcharge}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            <div className="flex shrink-0 flex-col gap-2 border-t border-stone-200 px-5 py-4 sm:flex-row-reverse">
              <button
                className="button-primary sm:flex-1"
                disabled={pending || emptyGroups.length > 0}
                onClick={() => formRef.current?.requestSubmit()}
                type="button"
              >
                {pending ? "Publicando…" : "Publicar menú de hoy"}
              </button>
              <button className="button-secondary sm:flex-1" onClick={() => setReview(null)} type="button">
                Seguir editando
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMsg && <Toast message={toastMsg} />}
    </>
  );
}
