/**
 * Authorization layer — the guarantee of tenant isolation.
 *
 * The middleware (middleware.ts) already isolates READS: a restaurant session can
 * only open `/restaurant/<its-own-slug>/*` pages. But Server Actions are POST
 * endpoints that are NOT scoped to a route — they receive a `restaurantId` (or a
 * slug / customerId / itemId) from the submitted FormData. Without an ownership
 * check, any authenticated operator could pass another restaurant's id and mutate
 * its data. These helpers close that gap so that:
 *
 *   - The platform admin (role = "admin") may manage EVERY restaurant.
 *   - A restaurant operator (role = "restaurant") may manage ONLY its own
 *     restaurant — never another tenant's menu, orders, customers or settings.
 *
 * Every restaurant-scoped Server Action MUST start with one of the canManage /
 * requireAdmin helpers below. They are server-only (they read the session cookie
 * and hit the DB) and must never be imported into the Edge middleware or Client
 * Components.
 */
import { getSession, type SessionPayload } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type OwnedRestaurant = { id: string; slug: string };

/** True when the session may manage the restaurant with this slug (admin, or its own operator). */
function ownsBySlug(session: SessionPayload, slug: string): boolean {
  return session.role === "admin" || (session.role === "restaurant" && session.restaurantSlug === slug);
}

/**
 * Require the platform admin. Throws "No autorizado." otherwise.
 * Use in admin-only actions (delete restaurant, subscriptions, demo data, …).
 */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("No autorizado.");
  return session;
}

/** Non-throwing admin check, for actions that return a state object. */
export async function isAdmin(): Promise<boolean> {
  const session = await getSession();
  return session?.role === "admin";
}

/**
 * Authorize a restaurant-scoped action identified by `restaurantId`.
 * Returns the owned restaurant ({ id, slug }) so callers can reuse the slug for
 * revalidation without a second query, or null when the caller may NOT manage it.
 */
export async function canManageRestaurantById(restaurantId: string): Promise<OwnedRestaurant | null> {
  const session = await getSession();
  if (!session || !restaurantId) return null;
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, slug: true },
  });
  if (!restaurant) return null;
  return ownsBySlug(session, restaurant.slug) ? restaurant : null;
}

/** Same as canManageRestaurantById but keyed by slug (for slug-based actions). */
export async function canManageRestaurantBySlug(slug: string): Promise<OwnedRestaurant | null> {
  const session = await getSession();
  if (!session || !slug || !ownsBySlug(session, slug)) return null;
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { id: true, slug: true },
  });
  return restaurant ?? null;
}

/**
 * Authorize an action that targets a customer. Resolves the customer's owning
 * restaurant and checks the caller may manage it. Guarantees a restaurant
 * operator can never touch another tenant's customers.
 */
export async function canManageCustomer(customerId: string): Promise<OwnedRestaurant | null> {
  const session = await getSession();
  if (!session || !customerId) return null;
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { restaurant: { select: { id: true, slug: true } } },
  });
  if (!customer) return null;
  return ownsBySlug(session, customer.restaurant.slug) ? customer.restaurant : null;
}

/**
 * Authorize an action that targets a catalog menu item. Walks item → category →
 * menu → restaurant and checks ownership.
 */
export async function canManageMenuItem(itemId: string): Promise<OwnedRestaurant | null> {
  const session = await getSession();
  if (!session || !itemId) return null;
  const item = await prisma.menuItem.findUnique({
    where: { id: itemId },
    select: { category: { select: { menu: { select: { restaurant: { select: { id: true, slug: true } } } } } } },
  });
  const restaurant = item?.category.menu.restaurant;
  if (!restaurant) return null;
  return ownsBySlug(session, restaurant.slug) ? restaurant : null;
}
