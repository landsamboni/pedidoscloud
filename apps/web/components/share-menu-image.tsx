"use client";

import { useEffect, useState } from "react";

function WhatsAppIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

/**
 * Share / download the generated menu image. The primary WhatsApp button is
 * shown on every device. On mobile (Web Share API with files) it opens the
 * native share sheet so the operator can post the image to a WhatsApp status;
 * on desktop it downloads the PNG. In BOTH cases it copies the customer order
 * link to the clipboard first, so the operator can paste it into the status
 * caption alongside the image.
 */
export function ShareMenuImage({ slug, publishedToday, hasTemplate }: { slug: string; publishedToday: boolean; hasTemplate: boolean }) {
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const imageUrl = `/r/${slug}/menu-image`;

  useEffect(() => {
    try {
      const probe = new File([new Blob()], "x.png", { type: "image/png" });
      setCanShareFiles(typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] }));
    } catch {
      setCanShareFiles(false);
    }
  }, []);

  if (!publishedToday) {
    return <p className="text-sm text-stone-500">Publica el menú de hoy para generar la imagen para compartir.</p>;
  }

  const orderLink = () => `${window.location.origin}/r/${slug}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(orderLink());
      setCopied(true);
      setTimeout(() => setCopied(false), 5000);
    } catch {
      // clipboard may be blocked; sharing/downloading still proceeds
    }
  }

  async function shareOrDownload() {
    setBusy(true);
    await copyLink();
    try {
      const res = await fetch(imageUrl, { cache: "no-store" });
      const blob = await res.blob();
      if (canShareFiles) {
        const file = new File([blob], `menu-${slug}.png`, { type: "image/png" });
        await navigator.share({ files: [file], text: orderLink(), title: "Menú de hoy" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `menu-${slug}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // user cancelled the share sheet — no-op
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          className="button-primary inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d]"
          disabled={busy}
          onClick={shareOrDownload}
          type="button"
        >
          <WhatsAppIcon />
          {busy ? "Preparando…" : canShareFiles ? "Compartir en WhatsApp" : "Descargar para WhatsApp"}
        </button>
        <a className="button-secondary" href={imageUrl} rel="noreferrer" target="_blank">
          Ver imagen
        </a>
      </div>

      {copied ? (
        <p className="text-sm font-medium text-emerald-700">
          ✓ Link de pedidos copiado. Pégalo en tu estado junto a la imagen.
        </p>
      ) : (
        <p className="text-xs text-stone-500">
          Al compartir, copiamos tu link de pedidos para que lo pegues en el estado de WhatsApp.
        </p>
      )}

      {!hasTemplate && (
        <p className="text-sm text-stone-500">
          Aún no has subido una plantilla de fondo: se usa un fondo por defecto. Sube una abajo para personalizarla.
        </p>
      )}
    </div>
  );
}
