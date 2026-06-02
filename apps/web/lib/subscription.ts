/**
 * Subscription status utilities for PedidosCloud.
 *
 * Status is derived dynamically from subscriptionEndsAt — no separate field needed.
 *
 * Cycle rules (confirmed by admin when payment is received):
 *   - Paid before/during expiry or grace period:
 *       new subscriptionEndsAt = currentEndsAt + 30 days
 *       (grace day "counts" — it's day 1 of the new cycle)
 *   - Paid after grace period (suspended):
 *       new subscriptionEndsAt = today + 30 days (fresh start)
 */

export type SubscriptionStatus =
  | "no-subscription" // never configured, admin hasn't set a start date
  | "active"          // > 7 days remaining
  | "expiring-soon"   // 1–7 days remaining — show warning
  | "grace"           // 0 to -24 h — 1-day grace period, still accessible
  | "suspended";      // more than 24 h past expiry — access blocked

export const GRACE_HOURS = 24;
export const WARN_DAYS = 7;
export const SUBSCRIPTION_DAYS = 30;

export function getSubscriptionStatus(endsAt: Date | null | undefined): SubscriptionStatus {
  if (!endsAt) return "no-subscription";
  const now = new Date();
  const msRemaining = endsAt.getTime() - now.getTime();
  const daysRemaining = msRemaining / (1000 * 60 * 60 * 24);

  if (daysRemaining > WARN_DAYS) return "active";
  if (daysRemaining > 0) return "expiring-soon";
  if (daysRemaining > -(GRACE_HOURS / 24)) return "grace";
  return "suspended";
}

export function getDaysRemaining(endsAt: Date): number {
  const now = new Date();
  return Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** Compute the new subscriptionEndsAt when admin confirms a payment. */
export function calculateNewSubscriptionEnd(
  currentEndsAt: Date | null | undefined,
  paymentConfirmedAt: Date,
): Date {
  const status = getSubscriptionStatus(currentEndsAt);
  const base =
    status === "suspended" || !currentEndsAt
      ? paymentConfirmedAt                 // fresh start
      : currentEndsAt;                     // extend from current end (grace day counts)

  const newEnd = new Date(base);
  newEnd.setDate(newEnd.getDate() + SUBSCRIPTION_DAYS);
  return newEnd;
}

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  "no-subscription": "Sin suscripción",
  "active":          "Activa",
  "expiring-soon":   "Por vencer",
  "grace":           "Período de gracia",
  "suspended":       "Suspendida",
};

export const STATUS_COLORS: Record<SubscriptionStatus, string> = {
  "no-subscription": "bg-stone-100 text-stone-600",
  "active":          "bg-emerald-100 text-emerald-700",
  "expiring-soon":   "bg-amber-100 text-amber-700",
  "grace":           "bg-orange-100 text-orange-700",
  "suspended":       "bg-red-100 text-red-700",
};
