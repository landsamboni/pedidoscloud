"use client";

import { useEffect, useState } from "react";

/**
 * Download / share buttons for the generated menu image (/r/[slug]/menu-image).
 * "Compartir" uses the Web Share API with the PNG file when available (mobile),
 * so the operator can post it straight to a WhatsApp status; otherwise we fall
 * back to a plain download.
 */
export function ShareMenuImage({ slug, publishedToday, hasTemplate }: { slug: string; publishedToday: boolean; hasTemplate: boolean }) {
  const [canShare, setCanShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const url = `/r/${slug}/menu-image`;

  useEffect(() => {
    // Probe file-sharing support (mobile Chrome/Safari) once on the client.
    try {
      const probe = new File([new Blob()], "x.png", { type: "image/png" });
      setCanShare(typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] }));
    } catch {
      setCanShare(false);
    }
  }, []);

  if (!publishedToday) {
    return <p className="text-sm text-stone-500">Publica el menú de hoy para generar la imagen para compartir.</p>;
  }

  async function share() {
    setBusy(true);
    try {
      const res = await fetch(url, { cache: "no-store" });
      const blob = await res.blob();
      const file = new File([blob], `menu-${slug}.png`, { type: "image/png" });
      await navigator.share({ files: [file], title: "Menú de hoy" });
    } catch {
      // user cancelled or sharing failed — no-op
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <a className="button-primary" download={`menu-${slug}.png`} href={url}>
          Descargar imagen
        </a>
        {canShare && (
          <button className="button-secondary" disabled={busy} onClick={share} type="button">
            {busy ? "Preparando…" : "Compartir"}
          </button>
        )}
        <a className="button-secondary" href={url} rel="noreferrer" target="_blank">
          Ver imagen
        </a>
      </div>
      {!hasTemplate && (
        <p className="text-sm text-stone-500">
          Aún no has subido una plantilla de fondo: se usa un fondo por defecto. Sube una abajo para personalizarla.
        </p>
      )}
    </div>
  );
}
