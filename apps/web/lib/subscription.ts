/**
 * Subscription status utilities for PedidosCloud.
 *
 * Status is derived dynamically from subscriptionEndsAt — no separate field needed.
 * There is NO grace period: suspension is immediate once endsAt passes.
 *
 * Renewal rule: new subscriptionEndsAt = paymentDate + 30 days, always.
 * The current endsAt is irrelevant to the calculation.
 */

export type SubscriptionStatus =
  | "no-subscription" // never configured
  | "active"          // > 7 days remaining
  | "expiring-soon"   // 1–7 days remaining — show warning
  | "suspended";      // endsAt is in the past — access blocked immediately

export const WARN_DAYS = 7;
export const SUBSCRIPTION_DAYS = 30;

export function getSubscriptionStatus(endsAt: Date | null | undefined): SubscriptionStatus {
  if (!endsAt) return "no-subscription";
  const now = new Date();
  const msRemaining = endsAt.getTime() - now.getTime();
  const daysRemaining = msRemaining / (1000 * 60 * 60 * 24);

  if (daysRemaining > WARN_DAYS) return "active";
  if (daysRemaining > 0) return "expiring-soon";
  return "suspended"; // immediate — no grace period
}

export function getDaysRemaining(endsAt: Date): number {
  const now = new Date();
  return Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * New subscription end = paymentDate + 30 days.
 * Simple and predictable: clicking "Registrar pago" on 02/06 always gives 02/07,
 * regardless of the current subscriptionEndsAt value.
 */
export function calculateNewSubscriptionEnd(paymentConfirmedAt: Date): Date {
  const newEnd = new Date(paymentConfirmedAt);
  newEnd.setDate(newEnd.getDate() + SUBSCRIPTION_DAYS);
  return newEnd;
}

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  "no-subscription": "Sin suscripción",
  "active":          "Activa",
  "expiring-soon":   "Por vencer",
  "suspended":       "Suspendida",
};

export const STATUS_COLORS: Record<SubscriptionStatus, string> = {
  "no-subscription": "bg-stone-100 text-stone-600",
  "active":          "bg-emerald-100 text-emerald-700",
  "expiring-soon":   "bg-amber-100 text-amber-700",
  "suspended":       "bg-red-100 text-red-700",
};
