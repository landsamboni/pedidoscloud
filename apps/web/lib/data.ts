import { prisma } from "@/lib/prisma";
import { dateKeyDaysAgo, dateKeyToUtcDate, localDateKey } from "@/lib/format";

export async function getRestaurantMenu(slug: string) {
  return prisma.restaurant.findFirst({
    where: { slug, active: true },
    include: {
      menus: {
        where: { date: dateKeyToUtcDate(localDateKey()) },
        take: 1,
      },
    },
  });
}

export async function getTodayOrders(slug: string) {
  return prisma.restaurant.findUnique({
    where: { slug },
    include: {
      orders: {
        where: { orderDate: localDateKey() },
        include: { customer: true, items: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function getAdminRestaurants() {
  return prisma.restaurant.findMany({
    include: {
      menus: {
        where: { date: dateKeyToUtcDate(localDateKey()) },
        take: 1,
      },
      orders: {
        where: { orderDate: localDateKey() },
        include: { customer: true, items: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getPublicOrder(slug: string, publicToken: string) {
  return prisma.order.findFirst({
    where: { publicToken, restaurant: { slug } },
    include: {
      restaurant: {
        select: {
          name: true,
          slug: true,
          nequiAccountName: true,
          nequiPhone: true,
          nequiQrPath: true,
          whatsappPhone: true,
        },
      },
      items: true,
    },
  });
}

// ---- History ----

export async function getRestaurantOrderDates(slug: string) {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!restaurant) return null;

  const groups = await prisma.order.groupBy({
    by: ["orderDate"],
    where: { restaurantId: restaurant.id },
    _count: { id: true },
    _sum: { total: true },
    orderBy: { orderDate: "desc" },
    take: 60, // last ~2 months of operating days
  });

  return { restaurant, dates: groups };
}

export async function getOrdersByDate(slug: string, date: string) {
  return prisma.restaurant.findUnique({
    where: { slug },
    include: {
      orders: {
        where: { orderDate: date },
        include: { customer: true, items: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

// ---- Analytics ----

export async function getRestaurantAnalytics(slug: string) {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!restaurant) return null;

  const since = dateKeyDaysAgo(89); // last 90 days (index 0 = 89 days ago)

  // Daily aggregates for confirmed orders (revenue)
  const daily = await prisma.order.groupBy({
    by: ["orderDate"],
    where: {
      restaurantId: restaurant.id,
      status: "PAYMENT_CONFIRMED",
      orderDate: { gte: since },
    },
    _sum: { total: true },
    _count: { id: true },
    orderBy: { orderDate: "asc" },
  });

  // All-time totals across all statuses
  const totals = await prisma.order.groupBy({
    by: ["status"],
    where: { restaurantId: restaurant.id },
    _count: { id: true },
    _sum: { total: true },
  });

  return { restaurant, daily, totals };
}
