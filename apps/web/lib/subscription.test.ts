import { describe, expect, it } from "vitest";
import {
  calculateNewSubscriptionEnd,
  getDaysRemaining,
  getSubscriptionStatus,
  SUBSCRIPTION_DAYS,
} from "@/lib/subscription";

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

describe("getSubscriptionStatus", () => {
  it("returns no-subscription when unset", () => {
    expect(getSubscriptionStatus(null)).toBe("no-subscription");
    expect(getSubscriptionStatus(undefined)).toBe("no-subscription");
  });
  it("returns active when more than 7 days remain", () => {
    expect(getSubscriptionStatus(daysFromNow(15))).toBe("active");
  });
  it("returns expiring-soon within 7 days", () => {
    expect(getSubscriptionStatus(daysFromNow(3))).toBe("expiring-soon");
  });
  it("returns suspended immediately once expired (no grace period)", () => {
    expect(getSubscriptionStatus(daysFromNow(-1))).toBe("suspended");
  });
});

describe("calculateNewSubscriptionEnd", () => {
  it("is always paymentDate + 30 days, regardless of current end", () => {
    const payment = new Date("2026-06-02T12:00:00.000Z");
    const end = calculateNewSubscriptionEnd(payment);
    const expected = new Date(payment);
    expected.setDate(expected.getDate() + SUBSCRIPTION_DAYS);
    expect(end.getTime()).toBe(expected.getTime());
  });
});

describe("getDaysRemaining", () => {
  it("rounds up partial days", () => {
    expect(getDaysRemaining(daysFromNow(2.4))).toBe(3);
  });
});
