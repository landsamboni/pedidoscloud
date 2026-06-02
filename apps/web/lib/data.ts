import { prisma } from "@/lib/prisma";
import { dateKeyDaysAgo, dateKeyToUtcDate, localDateKey } from "@/lib/format";

export async function getRestaurantCustomers(slug: string) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
  if (!restaurant) return null;

  const customers = await prisma.customer.findMany({
    where: { restaurantId: restaurant.id },
    include: {
      _count: { select: { orders: true } },
    },
    orderBy: { orders: { _count: "desc" } },
  });

  return { restaurant, customers };
}

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
      paymentMethods: { orderBy: { position: "asc" } },
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
      paymentMethods: { orderBy: { position: "asc" } },
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
          paymentMethods: {
            select: { id: true, label: true, phone: true, accountName: true },
            orderBy: { position: "asc" },
          },
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
    take: 60,
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

  const since = dateKeyDaysAgo(89);

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

  const totals = await prisma.order.groupBy({
    by: ["status"],
    where: { restaurantId: restaurant.id },
    _count: { id: true },
    _sum: { total: true },
  });

  return { restaurant, daily, totals };
}
