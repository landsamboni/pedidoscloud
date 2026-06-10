import { beforeEach, describe, expect, it, vi } from "vitest";

// Isolate the authorization logic from the session cookie and the DB.
vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    restaurant: { findUnique: vi.fn() },
    customer: { findUnique: vi.fn() },
    menuItem: { findUnique: vi.fn() },
  },
}));

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canManageCustomer,
  canManageMenuItem,
  canManageRestaurantById,
  canManageRestaurantBySlug,
  isAdmin,
  requireAdmin,
} from "@/lib/authz";

/* eslint-disable @typescript-eslint/no-explicit-any */
const setSession = (s: unknown) => (getSession as any).mockResolvedValue(s);
const RESTAURANT = { id: "r1", slug: "panza-feliz" };

beforeEach(() => vi.clearAllMocks());

describe("canManageRestaurantById — tenant isolation", () => {
  beforeEach(() => (prisma.restaurant.findUnique as any).mockResolvedValue(RESTAURANT));

  it("allows the platform admin", async () => {
    setSession({ role: "admin" });
    expect(await canManageRestaurantById("r1")).toEqual(RESTAURANT);
  });

  it("allows the owning restaurant operator", async () => {
    setSession({ role: "restaurant", restaurantSlug: "panza-feliz" });
    expect(await canManageRestaurantById("r1")).toEqual(RESTAURANT);
  });

  it("DENIES an operator from another tenant", async () => {
    setSession({ role: "restaurant", restaurantSlug: "otra-cocina" });
    expect(await canManageRestaurantById("r1")).toBeNull();
  });

  it("denies when there is no session", async () => {
    setSession(null);
    expect(await canManageRestaurantById("r1")).toBeNull();
  });

  it("denies when the restaurant does not exist", async () => {
    setSession({ role: "restaurant", restaurantSlug: "panza-feliz" });
    (prisma.restaurant.findUnique as any).mockResolvedValue(null);
    expect(await canManageRestaurantById("r1")).toBeNull();
  });
});

describe("canManageRestaurantBySlug — tenant isolation", () => {
  it("allows admin and the owner, denies another tenant", async () => {
    (prisma.restaurant.findUnique as any).mockResolvedValue(RESTAURANT);

    setSession({ role: "admin" });
    expect(await canManageRestaurantBySlug("panza-feliz")).toEqual(RESTAURANT);

    setSession({ role: "restaurant", restaurantSlug: "panza-feliz" });
    expect(await canManageRestaurantBySlug("panza-feliz")).toEqual(RESTAURANT);

    setSession({ role: "restaurant", restaurantSlug: "otra-cocina" });
    expect(await canManageRestaurantBySlug("panza-feliz")).toBeNull();
  });
});

describe("canManageCustomer — resolves owning restaurant", () => {
  beforeEach(() =>
    (prisma.customer.findUnique as any).mockResolvedValue({ restaurant: RESTAURANT }),
  );

  it("allows the owner, denies another tenant", async () => {
    setSession({ role: "restaurant", restaurantSlug: "panza-feliz" });
    expect(await canManageCustomer("c1")).toEqual(RESTAURANT);

    setSession({ role: "restaurant", restaurantSlug: "otra-cocina" });
    expect(await canManageCustomer("c1")).toBeNull();
  });

  it("denies when the customer does not exist", async () => {
    setSession({ role: "admin" });
    (prisma.customer.findUnique as any).mockResolvedValue(null);
    expect(await canManageCustomer("c1")).toBeNull();
  });
});

describe("canManageMenuItem — walks item -> category -> menu -> restaurant", () => {
  beforeEach(() =>
    (prisma.menuItem.findUnique as any).mockResolvedValue({
      category: { menu: { restaurant: RESTAURANT } },
    }),
  );

  it("allows the owner, denies another tenant", async () => {
    setSession({ role: "restaurant", restaurantSlug: "panza-feliz" });
    expect(await canManageMenuItem("i1")).toEqual(RESTAURANT);

    setSession({ role: "restaurant", restaurantSlug: "otra-cocina" });
    expect(await canManageMenuItem("i1")).toBeNull();
  });
});

describe("requireAdmin / isAdmin", () => {
  it("requireAdmin throws for non-admin and passes for admin", async () => {
    setSession({ role: "restaurant", restaurantSlug: "panza-feliz" });
    await expect(requireAdmin()).rejects.toThrow("No autorizado.");

    setSession(null);
    await expect(requireAdmin()).rejects.toThrow("No autorizado.");

    setSession({ role: "admin" });
    await expect(requireAdmin()).resolves.toMatchObject({ role: "admin" });
  });

  it("isAdmin reflects the session role", async () => {
    setSession({ role: "admin" });
    expect(await isAdmin()).toBe(true);

    setSession({ role: "restaurant", restaurantSlug: "panza-feliz" });
    expect(await isAdmin()).toBe(false);

    setSession(null);
    expect(await isAdmin()).toBe(false);
  });
});
