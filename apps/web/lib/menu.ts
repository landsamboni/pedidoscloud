/**
 * Utilities for menu items that may carry a price surcharge.
 *
 * Restaurant owners can specify a per-item surcharge using the pipe notation:
 *   "Costilla BBQ|3000"  →  name = "Costilla BBQ", surcharge = 3000 COP
 *   "Pollo asado"        →  name = "Pollo asado",  surcharge = 0
 *
 * The full raw string (including |surcharge) is stored in the database so that
 * order history preserves the original pricing. Use parseItemName() when
 * displaying to humans and parseSurcharge() when calculating order totals.
 *
 * "Sin sopa" is a special constant treated as always valid (surcharge 0).
 */

export const SIN_SOPA = "Sin sopa";

export function parseItemName(raw: string): string {
  const pipe = raw.indexOf("|");
  return (pipe < 0 ? raw : raw.slice(0, pipe)).trim();
}

export function parseSurcharge(raw: string): number {
  const pipe = raw.indexOf("|");
  if (pipe < 0) return 0;
  return Math.max(0, Number(raw.slice(pipe + 1)) || 0);
}

/** Full price for one selection = surcharges from all four components. */
export function itemSurcharge(soup: string, protein: string, side: string, drink: string): number {
  return parseSurcharge(soup) + parseSurcharge(protein) + parseSurcharge(side) + parseSurcharge(drink);
}
