"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createRestaurant } from "@/app/actions";

/** Convert a restaurant name to a URL-friendly slug. */
function nameToSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics (á→a, ñ→n, etc.)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")   // keep letters, digits, spaces, hyphens
    .trim()
    .replace(/\s+/g, "-")            // spaces → hyphens
    .replace(/-+/g, "-")             // collapse consecutive hyphens
    .slice(0, 60);
}

export function CreateRestaurantForm() {
  const [state, action, pending] = useActionState(createRestaurant, { error: "", success: false });
  const [slugEdited, setSlugEdited] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);

  // Reset form and slug-edited flag on success
  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setSlugEdited(false);
    }
  }, [state.success]);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!slugEdited && slugRef.current) {
      slugRef.current.value = nameToSlug(e.target.value);
    }
  }

  return (
    <div>
      {state.success && state.createdName && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-300 px-4 py-3 text-sm font-semibold text-emerald-800">
          <span className="text-lg">✓</span>
          Restaurante <strong>"{state.createdName}"</strong> creado correctamente.
        </div>
      )}

      <form ref={formRef} action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-0.5">Nombre</label>
          <input
            className="input"
            name="name"
            placeholder="Panza Feliz"
            required
            onChange={handleNameChange}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-0.5">
            Slug <span className="text-stone-400">(URL del restaurante)</span>
          </label>
          <input
            ref={slugRef}
            className="input font-mono text-sm"
            name="slug"
            placeholder="panza-feliz"
            required
            onChange={() => setSlugEdited(true)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-0.5">Precio base (COP)</label>
          <input className="input" min="1" name="basePrice" placeholder="14000" required type="number" />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-0.5">
            Contraseña inicial <span className="text-stone-400">(mín. 8 chars)</span>
          </label>
          <input className="input" minLength={8} name="password" placeholder="••••••••" type="password" />
        </div>

        <div className="flex flex-col justify-end">
          <button className="button-primary" disabled={pending} type="submit">
            {pending ? "Creando…" : "Crear restaurante"}
          </button>
        </div>
      </form>

      {state.error && (
        <p className="mt-2 text-sm font-medium text-red-700">{state.error}</p>
      )}
    </div>
  );
}
