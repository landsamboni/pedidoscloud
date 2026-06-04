"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/actions";

const INITIAL: ActionState = { ok: false, message: "", ts: 0 };

/** Floating confirmation toast — top-center, bright green, auto-dismiss. */
export function Toast({ message }: { message: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4" role="status">
      <div className="flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-xl ring-2 ring-emerald-300">
        ✓ {message}
      </div>
    </div>
  );
}

/**
 * Wraps a form whose server action returns ActionState, adding feedback without
 * navigating away: a floating success toast, an inline error, and (via
 * SubmitButton) a pending state. Reusable for the simple in-place settings forms.
 */
export function FeedbackForm({
  action,
  className,
  children,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, INITIAL);
  const [toast, setToast] = useState(false);
  const lastTs = useRef(0);

  useEffect(() => {
    if (state.ok && state.ts !== lastTs.current) {
      lastTs.current = state.ts;
      setToast(true);
      const t = setTimeout(() => setToast(false), 3500);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <>
      <form action={formAction} className={className}>
        {children}
      </form>
      {!state.ok && state.message && (
        <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{state.message}</p>
      )}
      {toast && <Toast message={state.message} />}
    </>
  );
}

/**
 * File input that validates size client-side immediately on selection.
 * Prevents large phone photos from causing a silent 413 crash.
 */
export function FileInput({
  maxMB = 12,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { maxMB?: number }) {
  const [sizeError, setSizeError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && file.size > maxMB * 1024 * 1024) {
      setSizeError(`El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB. El máximo permitido es ${maxMB} MB. Elige una imagen más pequeña o comprimida.`);
      e.target.value = ""; // clear the selection
    } else {
      setSizeError(null);
      props.onChange?.(e);
    }
  }

  return (
    <>
      <input {...props} onChange={handleChange} />
      {sizeError && <p className="mt-1 text-sm font-medium text-red-600">{sizeError}</p>}
    </>
  );
}

/** Submit button that shows a pending label while its form is submitting. */
export function SubmitButton({
  children,
  className = "button-primary",
  pendingLabel = "Guardando…",
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending} type="submit">
      {pending ? pendingLabel : children}
    </button>
  );
}
