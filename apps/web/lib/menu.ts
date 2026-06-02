/**
 * Utilities for menu items that may carry a price surcharge.
 *
 * Supported notation (both coexist for backward compatibility):
 *   "Costilla BBQ +3000"  — new preferred format (space + plus + digits at end)
 *   "Costilla BBQ|3000"   — legacy pipe format (still accepted for existing data)
 *   "Pollo asado"         — no surcharge (0)
 *
 * The admin menu textarea accepts "Costilla BBQ +3000" naturally.
 * The full raw string is stored in the DB so order history preserves pricing.
 */

export const SIN_SOPA = "Sin sopa";

// Matches " +3000" at the END of a string (space + plus + only digits)
const SURCHARGE_PLUS = /\s\+(\d+)$/;

export function parseItemName(raw: string): string {
  const plusMatch = raw.match(SURCHARGE_PLUS);
  if (plusMatch) return raw.slice(0, raw.length - plusMatch[0].length).trim();
  const pipe = raw.indexOf("|");
  if (pipe >= 0) return raw.slice(0, pipe).trim();
  return raw.trim();
}

export function parseSurcharge(raw: string): number {
  const plusMatch = raw.match(SURCHARGE_PLUS);
  if (plusMatch) return Math.max(0, Number(plusMatch[1]) || 0);
  const pipe = raw.indexOf("|");
  if (pipe >= 0) return Math.max(0, Number(raw.slice(pipe + 1)) || 0);
  return 0;
}

export function itemSurcharge(soup: string, protein: string, side: string, drink: string): number {
  return parseSurcharge(soup) + parseSurcharge(protein) + parseSurcharge(side) + parseSurcharge(drink);
}

/** Format a surcharge for display in buttons, e.g. 3000 → "+$3.000" */
export function formatSurcharge(n: number): string {
  return `+$${n.toLocaleString("es-CO")}`;
}
