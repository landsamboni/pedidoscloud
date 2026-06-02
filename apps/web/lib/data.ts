import { prisma } from "@/lib/prisma";
import { dateKeyToUtcDate, localDateKey } from "@/lib/format";

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
