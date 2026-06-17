/**
 * Supported business types.
 *
 * The type drives which flows are shown to the operator and their customers:
 *   orders flow  → restaurant, bakery, florist, laundry, other
 *   appointments → barbershop (and future: spa, clinic, etc.)
 *
 * New types can be added here without touching the DB schema (stored as a
 * plain string with a default of "restaurant").
 */

export type BusinessType =
  | "restaurant"
  | "bakery"
  | "barbershop"
  | "laundry"
  | "florist"
  | "other";

export const BUSINESS_TYPES: { value: BusinessType; label: string; emoji: string; flow: "orders" | "appointments" }[] = [
  { value: "restaurant",  label: "Restaurante",       emoji: "🍽️",  flow: "orders"       },
  { value: "bakery",      label: "Pastelería",         emoji: "🎂",  flow: "orders"       },
  { value: "florist",     label: "Floristería",        emoji: "💐",  flow: "orders"       },
  { value: "laundry",     label: "Tintorería",         emoji: "👔",  flow: "orders"       },
  { value: "barbershop",  label: "Barbería",           emoji: "✂️",  flow: "appointments" },
  { value: "other",       label: "Otro negocio",       emoji: "🏪",  flow: "orders"       },
];

export function getBusinessType(type: string) {
  return BUSINESS_TYPES.find((b) => b.value === type) ?? BUSINESS_TYPES[0];
}

export function businessTypeLabel(type: string): string {
  return getBusinessType(type).label;
}

export function businessTypeEmoji(type: string): string {
  return getBusinessType(type).emoji;
}
