"use client";

import { useState } from "react";

export function CopyPaymentNumber({ value, label = "Copiar número para transferir" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  async function copy() {
    setError(false);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand("copy");
        textarea.remove();
        if (!ok) throw new Error("Copy unavailable");
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(true);
    }
  }

  return (
    <>
      <button className="button-secondary w-full text-base" onClick={copy} type="button">
        {copied ? "✓ Número copiado" : label}
      </button>
      {error && (
        <p className="mt-2 text-sm font-medium text-red-700">
          No se pudo copiar. Mantén presionado el número para copiarlo manualmente.
        </p>
      )}
    </>
  );
}
