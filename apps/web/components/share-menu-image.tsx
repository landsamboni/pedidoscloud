"use client";

import { useEffect, useRef, useState, useCallback } from "react";

function WhatsAppIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

/**
 * Share / download the generated menu image, plus an in-app preview modal.
 *
 * The PNG is prefetched on mount so that:
 *  - navigator.share() is invoked WITHOUT an intervening network await — iOS
 *    Safari requires the share to fire within the user gesture, so awaiting the
 *    image fetch first made the share silently no-op.
 *  - the preview modal opens instantly.
 * The customer order link is copied to the clipboard on share so the operator
 * can paste it into the WhatsApp status caption.
 */
export function ShareMenuImage({ slug, publishedToday, hasTemplate, version = "" }: { slug: string; publishedToday: boolean; hasTemplate: boolean; version?: string }) {
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [canShareText, setCanShareText]   = useState(false);
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);
  const [desktopPanel, setDesktopPanel] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const blobRef = useRef<Blob | null>(null);
  const imageUrl = `/r/${slug}/menu-image?v=${encodeURIComponent(version)}`;

  useEffect(() => {
    try {
      const probe = new File([new Blob()], "x.png", { type: "image/png" });
      setCanShareFiles(typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] }));
    } catch {
      setCanShareFiles(false);
    }
    // Text-only share (works on desktop Chrome, Edge, Android — does NOT require files)
    setCanShareText(typeof navigator.share === "function");
  }, []);

  // Prefetch the PNG (ready before the user taps share / opens preview). Re-runs
  // when imageUrl changes (i.e. the menu was edited), discarding the stale blob.
  useEffect(() => {
    if (!publishedToday) return;
    blobRef.current = null;
    setObjectUrl(null);
    let cancelled = false;
    let url: string | null = null;
    fetch(imageUrl, { cache: "no-store" })
      .then((r) => r.blob())
      .then((b) => {
        if (cancelled) return;
        blobRef.current = b;
        url = URL.createObjectURL(b);
        setObjectUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [imageUrl, publishedToday]);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPreview(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  if (!publishedToday) {
    return <p className="text-sm text-stone-500">Publica el menú de hoy para generar la imagen para compartir.</p>;
  }

  const orderLink = () => `${window.location.origin}/r/${slug}`;

  function copyLink() {
    navigator.clipboard
      ?.writeText(orderLink())
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 5000); })
      .catch(() => {});
  }

  function downloadBlob(b: Blob) {
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u;
    a.download = `menu-${slug}.png`;
    a.click();
    URL.revokeObjectURL(u);
  }

  async function onShare() {
    copyLink();
    let b = blobRef.current;
    if (!b) {
      setBusy(true);
      try {
        b = await (await fetch(imageUrl, { cache: "no-store" })).blob();
        blobRef.current = b;
      } catch {
        setBusy(false);
        return;
      }
      setBusy(false);
    }

    if (canShareFiles) {
      // Mobile / desktop with file-share support → native OS share sheet with the image
      try {
        await navigator.share({
          files: [new File([b], `menu-${slug}.png`, { type: "image/png" })],
          text: orderLink(),
          title: "Menú de hoy",
        });
      } catch {
        // dismissed — no-op
      }
    } else if (canShareText) {
      // Desktop Chrome/Edge: share the menu link via native share dialog
      // (image files not supported but the link lets customers order directly)
      try {
        await navigator.share({ url: orderLink(), title: "Menú de hoy" });
        // Also download the image so they can attach it manually if they want
        downloadBlob(b);
      } catch {
        // dismissed — fall through to the desktop panel
        setDesktopPanel(true);
      }
    } else {
      // Safari / Firefox desktop: no share API — show the helper panel
      setDesktopPanel(true);
    }
  }

  const waWebLink = `https://web.whatsapp.com/send?text=${encodeURIComponent(orderLink())}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button className="button-primary inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d]" disabled={busy} onClick={onShare} type="button">
          <WhatsAppIcon />
          {busy ? "Preparando…" : "Compartir en WhatsApp"}
        </button>
        <button className="button-secondary" onClick={() => { setImgLoaded(false); setPreview(true); }} type="button">
          Ver imagen
        </button>
      </div>

      {copied && (
        <p className="text-sm font-medium text-emerald-700">✓ Link de pedidos copiado.</p>
      )}

      {!hasTemplate && (
        <p className="text-sm text-stone-500">Aún no has subido una plantilla de fondo: se usa un fondo por defecto. Sube una abajo para personalizarla.</p>
      )}

      {/* Desktop helper panel — shown when native file-share isn't available */}
      {desktopPanel && (
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-stone-800">Compartir desde computador</p>
            <button className="text-stone-400 hover:text-stone-600 text-lg leading-none" onClick={() => setDesktopPanel(false)} type="button">✕</button>
          </div>
          <ol className="text-sm text-stone-600 space-y-2 list-decimal list-inside">
            <li>
              <button
                className="font-semibold text-brand-blue hover:underline"
                onClick={() => { blobRef.current && downloadBlob(blobRef.current); }}
                type="button"
              >
                Descarga la imagen del menú
              </button>
              {" "}— se guarda en tu carpeta de Descargas.
            </li>
            <li>
              <a
                className="font-semibold text-[#25D366] hover:underline"
                href={waWebLink}
                rel="noreferrer"
                target="_blank"
              >
                Abre WhatsApp Web
              </a>
              {" "}con el link del menú ya listo para enviar.
            </li>
            <li>En WhatsApp Web, adjunta la imagen descargada al chat o estado que quieras.</li>
          </ol>
          <p className="text-xs text-stone-400">
            💡 Para publicar la imagen directamente como <strong>estado</strong> de WhatsApp, hazlo desde tu celular donde tienes la app instalada.
          </p>
          <div className="flex gap-2">
            <button
              className="button-secondary text-sm py-1.5"
              onClick={() => { blobRef.current && downloadBlob(blobRef.current); }}
              type="button"
            >
              ↓ Descargar imagen
            </button>
            <button
              className="button-secondary text-sm py-1.5"
              onClick={copyLink}
              type="button"
            >
              {copied ? "✓ Copiado" : "Copiar link del menú"}
            </button>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(false)}>
          <div className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-5 py-4">
              <p className="font-semibold">Imagen del menú</p>
              <button aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100" onClick={() => setPreview(false)} type="button">✕</button>
            </div>
            <div className="relative flex min-h-[320px] items-center justify-center overflow-auto p-4">
              {!imgLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-stone-500">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-stone-200 border-t-teal-500" />
                  <p className="text-sm">Generando imagen…</p>
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Imagen del menú de hoy"
                className={`h-auto w-full rounded-xl transition-opacity ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                onError={() => setImgLoaded(true)}
                onLoad={() => setImgLoaded(true)}
                src={objectUrl ?? imageUrl}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
