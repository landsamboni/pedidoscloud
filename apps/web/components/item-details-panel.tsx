"use client";

import { useRef, useState, useTransition } from "react";
import { updateMenuItemDetails } from "@/app/actions";
import { FileInput, Toast } from "@/components/feedback-form";
import { resolveFileUrl } from "@/lib/file-url";

/**
 * Standalone panel for editing a catalog item's description and photo.
 * Uses useTransition + direct action call instead of a nested <form> —
 * the catalog editor already wraps everything in a <form>, so nesting
 * another <form> here is invalid HTML and triggers React's form error.
 */
export function ItemDetailsPanel({
  itemId,
  returnPath,
  initialDescription,
  initialImagePath,
}: {
  itemId: string;
  returnPath: string;
  initialDescription?: string | null;
  initialImagePath?: string | null;
}) {
  const [description, setDescription] = useState(initialDescription ?? "");
  const [imagePath, setImagePath] = useState(initialImagePath ?? null);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function save(clearImage = false) {
    const fd = new FormData();
    fd.append("itemId", itemId);
    fd.append("returnPath", returnPath);
    fd.append("description", clearImage ? description : description);
    if (clearImage) fd.append("clearImage", "1");
    else {
      const file = fileRef.current?.files?.[0];
      if (file) fd.append("image", file);
    }

    startTransition(async () => {
      const result = await updateMenuItemDetails({ ok: false, message: "", ts: 0 }, fd);
      if (result.ok) {
        setError(null);
        setToast("Detalles actualizados.");
        setTimeout(() => setToast(null), 3500);
        if (fileRef.current) fileRef.current.value = "";
        // Update local imagePath from the action result — no router.refresh() needed,
        // which would reset the CatalogMenuEditor state.
        if (result.data && "imagePath" in result.data) {
          setImagePath(result.data.imagePath ?? null);
        }
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="mt-2 grid gap-2">
      <label className="text-xs font-medium text-stone-600">
        Descripción
        {description && (
          <button
            className="ml-2 text-xs font-medium text-red-600 hover:underline"
            onClick={() => { setDescription(""); }}
            type="button"
          >
            Quitar
          </button>
        )}
        <textarea
          className="input mt-1 min-h-20 resize-none text-xs"
          maxLength={300}
          onChange={e => setDescription(e.target.value)}
          placeholder="Ingredientes, tamaño, sabor especial, etc."
          value={description}
        />
      </label>
      <label className="text-xs font-medium text-stone-600">
        Foto del producto <span className="font-normal text-stone-400">(JPG/PNG/WEBP, opcional)</span>
        {imagePath && (
          <div className="mt-1 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="foto" className="h-12 w-12 rounded-lg border object-cover" src={resolveFileUrl(imagePath) ?? ""} />
            <div className="flex flex-col gap-1">
              <span className="text-xs text-teal-600">Foto configurada.</span>
              <button
                className="text-xs font-medium text-red-600 hover:underline text-left"
                onClick={() => { setImagePath(null); void save(true); }}
                type="button"
              >
                Quitar foto
              </button>
            </div>
          </div>
        )}
        <FileInput accept="image/jpeg,image/png,image/webp" className="input mt-1 text-xs" ref={fileRef} type="file" />
      </label>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      <button
        className="button-secondary text-xs"
        disabled={pending}
        onClick={() => save()}
        type="button"
      >
        {pending ? "Guardando…" : "Guardar descripción y foto"}
      </button>
      {toast && <Toast message={toast} />}
    </div>
  );
}
