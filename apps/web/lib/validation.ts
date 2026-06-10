/**
 * Single source of truth for customer-input validation rules.
 *
 * The same rules run in three places — the two customer order forms (client,
 * inline error messages) and the server actions (authoritative, throw on
 * failure). Keeping them here prevents the rules and Spanish messages from
 * drifting apart, which previously happened across three copies.
 *
 * Each `*Message` function returns a human error string, or null when valid.
 */

/** Max characters we accept for free-text fields, to bound storage and abuse. */
export const MAX_NAME_LENGTH = 80;
export const MAX_ADDRESS_LENGTH = 200;

export function nameMessage(value: string): string | null {
  const clean = value.trim();
  if (!clean) return "Escribe tu nombre y apellido.";
  if (clean.length < 5) return "El nombre debe tener al menos 5 caracteres.";
  if (clean.length > MAX_NAME_LENGTH) return `El nombre es demasiado largo (máx. ${MAX_NAME_LENGTH}).`;
  if (clean.split(" ").filter(Boolean).length < 2) return "Incluye nombre y apellido completos.";
  return null;
}

export function phoneMessage(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10) return "El teléfono debe tener 10 dígitos (ej. 3001234567).";
  if (!digits.startsWith("3")) return "Ingresa un celular colombiano válido (comienza con 3).";
  return null;
}

export function addressMessage(value: string): string | null {
  const clean = value.trim();
  if (!clean) return "Escribe tu dirección de entrega.";
  if (clean.length < 10) return "La dirección debe ser más específica (mínimo 10 caracteres).";
  if (clean.length > MAX_ADDRESS_LENGTH) return `La dirección es demasiado larga (máx. ${MAX_ADDRESS_LENGTH}).`;
  if (!/\d/.test(clean)) return "La dirección debe incluir un número (ej. Cra 5 #12-34, apto 301).";
  return null;
}

/** Digits-only phone, capped at 10. */
export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}
