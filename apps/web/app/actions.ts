"use server";

import { OrderStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canManageCustomer,
  canManageMenuItem,
  canManageRestaurantById,
  canManageRestaurantBySlug,
  isAdmin,
  requireAdmin,
} from "@/lib/authz";
import { dateKeyToUtcDate, localDateKey } from "@/lib/format";
import { logger } from "@/lib/logger";
import { itemSurcharge, parseItemName, parseSurcharge, SIN_SOPA } from "@/lib/menu";
import { prisma } from "@/lib/prisma";
import { saveUpload } from "@/lib/storage";
import { addressMessage, nameMessage, normalizePhone, phoneMessage } from "@/lib/validation";

/** Standard "not authorized" state for actions that return an ActionState. */
const UNAUTHORIZED = (): ActionState => ({ ok: false, message: "No autorizado.", ts: Date.now() });

// Upper bounds on operator-entered text, to keep storage and the UI bounded.
const MAX_MENU_OPTION_LEN = 120; // a single combo option line ("Costilla BBQ +3000")
const MAX_CATEGORY_NAME_LEN = 60;
const MAX_ITEM_NAME_LEN = 80;
const MAX_ITEM_DESCRIPTION_LEN = 300;

type LunchInput = {
  soup: string;
  protein: string;
  side: string;
  drink: string;
};

type CreateOrderInput = {
  restaurantSlug: string;
  name: string;
  phone: string;
  address: string;
  items: LunchInput[];
  fulfillment?: "delivery" | "pickup";
};

function required(value: string, field: string) {
  const clean = value.trim();
  if (!clean) throw new Error(`Falta completar: ${field}.`);
  return clean;
}

// Authoritative server-side validation — delegates to the shared rules in
// lib/validation.ts (same rules the client forms use) and throws on failure.
function validateFullName(value: string) {
  const message = nameMessage(value);
  if (message) throw new Error(message);
  return value.trim();
}

function validatePhone(value: string) {
  const message = phoneMessage(value);
  if (message) throw new Error(message);
  return normalizePhone(value);
}

function validateAddress(value: string) {
  const message = addressMessage(value);
  if (message) throw new Error(message);
  return value.trim();
}

function splitOptions(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split("\n")
    .map((option) => option.trim())
    .filter(Boolean);
}

function safeReturnPath(value: FormDataEntryValue | null, fallback: string) {
  const path = String(value ?? "");
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}


export async function createOrder(input: CreateOrderInput) {
  const fulfillment = input.fulfillment === "pickup" ? "pickup" : "delivery";
  const name = validateFullName(input.name);
  const phone = validatePhone(input.phone);
  const address = fulfillment === "pickup" ? "Recoge en el restaurante" : validateAddress(input.address);
  if (!input.items.length) throw new Error("Agrega al menos un almuerzo.");

  const order = await prisma.$transaction(async (tx) => {
    const restaurant = await tx.restaurant.findFirst({
      where: { slug: input.restaurantSlug, active: true },
      include: {
        menus: {
          where: { date: dateKeyToUtcDate(localDateKey()) },
          take: 1,
        },
      },
    });
    if (!restaurant) throw new Error("Restaurante no encontrado.");

    const menu = restaurant.menus[0];
    if (!menu) throw new Error("El restaurante no tiene menú para hoy.");

    const soupNames    = menu.soups.map(parseItemName);
    const proteinNames = menu.proteins.map(parseItemName);
    const sideNames    = menu.sides.map(parseItemName);
    const drinkNames   = menu.drinks.map(parseItemName);

    for (const item of input.items) {
      const soupOk = item.soup === SIN_SOPA || soupNames.includes(parseItemName(item.soup));
      if (
        !soupOk ||
        !proteinNames.includes(parseItemName(item.protein)) ||
        !sideNames.includes(parseItemName(item.side)) ||
        !drinkNames.includes(parseItemName(item.drink))
      ) {
        throw new Error("Una selección ya no está disponible. Actualiza el menú.");
      }
    }

    const customer = await tx.customer.upsert({
      where: {
        restaurantId_phone: { restaurantId: restaurant.id, phone },
      },
      update: { name, lastAddress: address },
      create: { restaurantId: restaurant.id, name, phone, lastAddress: address },
    });

    const orderDate = localDateKey();
    const counter = await tx.dailyOrderCounter.upsert({
      where: {
        restaurantId_date: { restaurantId: restaurant.id, date: orderDate },
      },
      update: { lastNumber: { increment: 1 } },
      create: { restaurantId: restaurant.id, date: orderDate, lastNumber: 1 },
    });

    // Food total = sum of (basePrice + individual surcharges) for each lunch
    const foodTotal = input.items.reduce((sum, item) => {
      const extra =
        parseSurcharge(item.soup) +
        parseSurcharge(item.protein) +
        parseSurcharge(item.side) +
        parseSurcharge(item.drink);
      return sum + Number(restaurant.basePrice) + extra;
    }, 0);

    // Delivery fee only when delivering and the restaurant charges a fixed fee.
    const deliveryFee =
      fulfillment === "delivery" && restaurant.deliveryMode === "fixed"
        ? Number(restaurant.deliveryFee ?? 0)
        : 0;
    const total = foodTotal + deliveryFee;

    return tx.order.create({
      data: {
        restaurantId: restaurant.id,
        customerId: customer.id,
        customerName: name, // snapshot — name won't change even if customer upserts later
        orderDate,
        orderNumber: counter.lastNumber,
        status: OrderStatus.PAYMENT_PENDING,
        total: new Prisma.Decimal(total),
        deliveryFee: new Prisma.Decimal(deliveryFee),
        fulfillment,
        address,
        items: {
          create: input.items.map((item) => {
            const extra =
              parseSurcharge(item.soup) +
              parseSurcharge(item.protein) +
              parseSurcharge(item.side) +
              parseSurcharge(item.drink);
            return {
              ...item,
              price: new Prisma.Decimal(Number(restaurant.basePrice) + extra),
            };
          }),
        },
      },
    });
  });

  revalidatePath(`/restaurant/${input.restaurantSlug}/orders`);
  revalidatePath("/admin");
  logger.info("order_created", { mode: "combo", restaurantSlug: input.restaurantSlug, orderNumber: order.orderNumber });
  return { orderNumber: order.orderNumber, publicToken: order.publicToken };
}

export type FindOrderState = { error: string };

export async function findTodayOrder(_: FindOrderState, formData: FormData): Promise<FindOrderState> {
  const restaurantSlug = String(formData.get("restaurantSlug"));
  const phone = String(formData.get("phone") ?? "").trim();
  if (!phone) return { error: "Escribe el teléfono que usaste al pedir." };
  const rawOrderNumber = String(formData.get("orderNumber") ?? "").replace(/\D/g, "");
  const orderNumber = Number(rawOrderNumber);
  if (!Number.isInteger(orderNumber) || orderNumber <= 0) {
    return { error: "Escribe un número de pedido válido." };
  }

  const order = await prisma.order.findFirst({
    where: {
      orderDate: localDateKey(),
      orderNumber,
      restaurant: { slug: restaurantSlug },
      customer: { phone },
    },
    select: { publicToken: true },
  });
  if (!order) return { error: "No encontramos un pedido de hoy con ese número y teléfono." };

  redirect(`/r/${restaurantSlug}/orders/${order.publicToken}`);
}

/** Admin: update the display name of a restaurant. */
export async function updateRestaurantName(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return UNAUTHORIZED();
  const restaurantId = String(formData.get("restaurantId"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "El nombre no puede estar vacío.", ts: Date.now() };
  if (name.length > 100) return { ok: false, message: "El nombre es demasiado largo (máx. 100 caracteres).", ts: Date.now() };

  const restaurant = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { name },
    select: { slug: true },
  });
  revalidatePath("/admin");
  revalidatePath(`/admin/restaurants/${restaurant.slug}`);
  revalidatePath(`/r/${restaurant.slug}`);
  return { ok: true, message: "Nombre actualizado.", ts: Date.now() };
}

export async function updateOrderStatus(formData: FormData) {
  const id = String(formData.get("id"));
  const slug = String(formData.get("slug"));
  const status = String(formData.get("status")) as OrderStatus;
  if (!Object.values(OrderStatus).includes(status)) throw new Error("Estado inválido.");

  // Tenant isolation: only the admin or the owning restaurant may change a status.
  const restaurant = await canManageRestaurantBySlug(slug);
  if (!restaurant) throw new Error("No autorizado.");
  const order = await prisma.order.findFirst({ where: { id, restaurantId: restaurant.id } });
  if (!order) throw new Error("Pedido no encontrado.");
  await prisma.order.update({ where: { id: order.id }, data: { status } });
  revalidatePath(`/restaurant/${slug}/orders`);
  revalidatePath(`/r/${slug}/orders/${order.publicToken}`);
  revalidatePath("/admin");
}

export type CreateRestaurantState = { error: string; success: boolean; createdName?: string };

export async function createRestaurant(
  _: CreateRestaurantState,
  formData: FormData,
): Promise<CreateRestaurantState> {
  try {
    if (!(await isAdmin())) return { error: "No autorizado.", success: false };
    const name = required(String(formData.get("name") ?? ""), "nombre");
    const slug = required(String(formData.get("slug") ?? ""), "slug")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const basePrice = Number(formData.get("basePrice"));
    if (!Number.isFinite(basePrice) || basePrice <= 0) return { error: "El precio base debe ser mayor a 0.", success: false };

    const { BUSINESS_TYPES } = await import("@/lib/business-types");
    const validTypes = BUSINESS_TYPES.map((b) => b.value);
    const businessType = validTypes.includes(String(formData.get("businessType") ?? "") as never)
      ? String(formData.get("businessType"))
      : "restaurant";

    const existing = await prisma.restaurant.findUnique({ where: { slug } });
    if (existing) return { error: `El slug "${slug}" ya está en uso. Elige otro.`, success: false };

    const rawPassword = String(formData.get("password") ?? "").trim();
    let passwordHash: string | undefined;
    if (rawPassword.length >= 8) {
      const { hash } = await import("bcryptjs");
      passwordHash = await hash(rawPassword, 12);
    }

    await prisma.restaurant.create({ data: { name, slug, basePrice, businessType, ...(passwordHash ? { passwordHash } : {}) } });
    revalidatePath("/admin");
    return { error: "", success: true, createdName: name };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo crear el restaurante.", success: false };
  }
}

/**
 * Admin: delete all orders (and daily counters) for a restaurant.
 * Requires the admin to type the restaurant slug as confirmation to prevent
 * accidental data loss. OrderItems are cascade-deleted by the DB constraint.
 */
export async function deleteRestaurantOrders(formData: FormData) {
  await requireAdmin();

  const restaurantId = String(formData.get("restaurantId"));
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();

  if (confirmation !== slug) throw new Error("La confirmación no coincide con el slug del restaurante.");

  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) throw new Error("Restaurante no encontrado.");

  await prisma.$transaction([
    prisma.order.deleteMany({ where: { restaurantId } }),
    prisma.dailyOrderCounter.deleteMany({ where: { restaurantId } }),
  ]);

  revalidatePath("/admin");
  revalidatePath(`/restaurant/${restaurant.slug}`);
  revalidatePath(`/restaurant/${restaurant.slug}/orders`);
  revalidatePath(`/restaurant/${restaurant.slug}/analytics`);
  revalidatePath(`/restaurant/${restaurant.slug}/history`);
}

/** Admin: delete orders for a restaurant on a specific date. */
export async function deleteRestaurantOrdersByDate(formData: FormData) {
  await requireAdmin();

  const restaurantId = String(formData.get("restaurantId"));
  const date = String(formData.get("date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Fecha inválida.");

  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) throw new Error("Restaurante no encontrado.");

  await prisma.$transaction([
    prisma.order.deleteMany({ where: { restaurantId, orderDate: date } }),
    prisma.dailyOrderCounter.deleteMany({ where: { restaurantId, date } }),
  ]);

  revalidatePath("/admin");
  revalidatePath(`/restaurant/${restaurant.slug}/history`);
  revalidatePath(`/restaurant/${restaurant.slug}/analytics`);
}

/** Admin: populate realistic demo orders for the last N days (for demos/sales presentations). */
export async function populateDemoData(formData: FormData) {
  await requireAdmin();

  const restaurantId = String(formData.get("restaurantId"));
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, slug: true, basePrice: true },
  });
  if (!restaurant) throw new Error("Restaurante no encontrado.");
  // Demo data is only for the showcase restaurant — never for real clients.
  if (restaurant.slug !== "panza-feliz") throw new Error("Los datos demo solo están disponibles para el restaurante de demostración.");

  const DEMO_MENU = {
    soups: ["Sopa de lentejas", "Sancocho de pollo", "Crema de zanahoria", "Sopa de arvejas"],
    proteins: ["Chuleta de pollo", "Carne asada", "Mojarra frita", "Costilla BBQ +3000", "Pollo apanado"],
    sides: ["Frijoles", "Lentejas", "Papa salada", "Ensalada de papa"],
    drinks: ["Jugo de lulo", "Limonada de coco", "Jugo de maracuyá", "Agua"],
  };

  const CUSTOMERS = [
    { name: "Carlos Rodríguez", phone: "3001234567", address: "Cra 7 #45-23" },
    { name: "María García", phone: "3112345678", address: "Cll 50 #12-34 apto 301" },
    { name: "Andrés Martínez", phone: "3203456789", address: "Cra 15 #80-10" },
    { name: "Laura Sánchez", phone: "3154567890", address: "Cll 100 #22-15 apto 501" },
    { name: "Juan Pérez", phone: "3005678901", address: "Cra 30 #63-40" },
    { name: "Valentina López", phone: "3166789012", address: "Cll 72 #48-20" },
    { name: "Diego Castro", phone: "3217890123", address: "Cra 24 #55-67 of 202" },
    { name: "Camila Torres", phone: "3008901234", address: "Cll 85 #11-32" },
    { name: "Felipe Vargas", phone: "3159012345", address: "Cra 45 #90-15" },
    { name: "Ana Moreno", phone: "3020123456", address: "Cll 35 #28-50 apto 104" },
    { name: "Santiago Jiménez", phone: "3171234567", address: "Cra 9 #72-18" },
    { name: "Isabella Herrera", phone: "3082345678", address: "Cll 60 #35-25" },
  ];

  const rand = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

  let totalCreated = 0;
  const DAYS = 15;

  for (let daysAgo = DAYS; daysAgo >= 0; daysAgo--) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const dateKey = localDateKey(date);
    const isToday = daysAgo === 0;
    const ordersCount = isToday ? randInt(3, 5) : randInt(5, 10);

    // Ensure menu exists for this day
    await prisma.menu.upsert({
      where: { restaurantId_date: { restaurantId: restaurant.id, date: dateKeyToUtcDate(dateKey) } },
      update: {},
      create: { restaurantId: restaurant.id, date: dateKeyToUtcDate(dateKey), ...DEMO_MENU },
    });

    // Get or reset counter for this day
    const existingCounter = await prisma.dailyOrderCounter.findUnique({
      where: { restaurantId_date: { restaurantId: restaurant.id, date: dateKey } },
    });
    let orderNum = existingCounter?.lastNumber ?? 0;

    for (let j = 0; j < ordersCount; j++) {
      const cust = rand(CUSTOMERS);
      const numItems = Math.random() < 0.2 ? 2 : 1;

      // Upsert customer
      const customer = await prisma.customer.upsert({
        where: { restaurantId_phone: { restaurantId: restaurant.id, phone: cust.phone } },
        update: { name: cust.name, lastAddress: cust.address },
        create: { restaurantId: restaurant.id, name: cust.name, phone: cust.phone, lastAddress: cust.address },
      });

      orderNum++;

      // Status distribution:
      //   Past days → only terminal states (CONFIRMED or CANCELLED).
      //     A day that has ended cannot have pending orders.
      //   Today → realistic mix with some pending for live demo feel.
      let status: "PAYMENT_CONFIRMED" | "CANCELLED" | "PAYMENT_PENDING";
      if (isToday) {
        status = j < 2 ? "PAYMENT_PENDING" : j === 2 ? "CANCELLED" : "PAYMENT_CONFIRMED";
      } else {
        status = Math.random() < 0.88 ? "PAYMENT_CONFIRMED" : "CANCELLED";
      }

      const items = Array.from({ length: numItems }, () => ({
        soup: rand(DEMO_MENU.soups),
        protein: rand(DEMO_MENU.proteins),
        side: rand(DEMO_MENU.sides),
        drink: rand(DEMO_MENU.drinks),
      }));

      // Per-lunch price = basePrice + all four surcharges (matches createOrder).
      const lunchPrice = (item: { soup: string; protein: string; side: string; drink: string }) =>
        Number(restaurant.basePrice) + itemSurcharge(item.soup, item.protein, item.side, item.drink);
      const total = items.reduce((sum, item) => sum + lunchPrice(item), 0);

      // Set a realistic createdAt (10am-2pm Bogota = 3pm-7pm UTC)
      const orderCreatedAt = new Date(date);
      orderCreatedAt.setUTCHours(15 + j % 4, j * 7 % 60, 0, 0);

      await prisma.order.create({
        data: {
          restaurantId: restaurant.id,
          customerId: customer.id,
          customerName: cust.name,
          orderDate: dateKey,
          orderNumber: orderNum,
          status: status as OrderStatus,
          total: new Prisma.Decimal(total),
          address: cust.address,
          createdAt: orderCreatedAt,
          ...(status !== "PAYMENT_PENDING" ? { paymentSubmittedAt: orderCreatedAt } : {}),
          items: {
            create: items.map((item) => ({
              ...item,
              price: new Prisma.Decimal(lunchPrice(item)),
            })),
          },
        },
      });

      totalCreated++;
    }

    // Update/create counter for this day
    await prisma.dailyOrderCounter.upsert({
      where: { restaurantId_date: { restaurantId: restaurant.id, date: dateKey } },
      update: { lastNumber: orderNum },
      create: { restaurantId: restaurant.id, date: dateKey, lastNumber: orderNum },
    });
  }

  revalidatePath("/admin");
  revalidatePath(`/restaurant/${restaurant.slug}`);
}

/** Admin: populate catalog demo orders for mi-pasteleria (for sales demos). */
export async function populateCatalogDemoData(formData: FormData) {
  await requireAdmin();

  const restaurantId = String(formData.get("restaurantId"));
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, slug: true },
  });
  if (!restaurant) throw new Error("Restaurante no encontrado.");
  if (restaurant.slug !== "mi-pasteleria") throw new Error("Datos demo solo disponibles para Mi Pastelería.");

  const CUSTOMERS = [
    { name: "Valentina Muñoz", phone: "3101234567", address: "Cra 5 #12-34 Popayán" },
    { name: "Camila Ospina", phone: "3152345678", address: "Cll 4N #2-15 Popayán" },
    { name: "Diana Torres", phone: "3003456789", address: "Cra 9 #18-50 apto 301" },
    { name: "Juliana García", phone: "3204567890", address: "Cll 10 #8-22 Popayán" },
    { name: "Marcela Ríos", phone: "3115678901", address: "Cra 12 #6-40 Popayán" },
    { name: "Andrea Castro", phone: "3006789012", address: "Cll 6N #5-18 apto 202" },
    { name: "Sofía Leal", phone: "3177890123", address: "Cra 7 #14-30 Popayán" },
    { name: "Laura Quintero", phone: "3028901234", address: "Cll 8 #11-45 Popayán" },
    { name: "Natalia Vargas", phone: "3159012345", address: "Cra 3 #20-12 Popayán" },
    { name: "Paula Romero", phone: "3100123456", address: "Cll 15 #4-28 apto 104" },
  ];

  // Realistic product combos (popular items for a bakery demo)
  const DEMO_ORDERS = [
    [{ cat: "Tortas", item: "Torta Castilla", price: 26000, qty: 1 }],
    [{ cat: "Tortas", item: "Torta Red Velvet", price: 26000, qty: 1 }],
    [{ cat: "Tortas", item: "Torta Zanahoria", price: 26000, qty: 2 }],
    [{ cat: "Cinnamon Rolls", item: "Cinnamon Rolls x 4", price: 26000, qty: 1 }],
    [{ cat: "Cinnamon Rolls", item: "Cinnamon Rolls x 6", price: 32000, qty: 1 }],
    [{ cat: "Tortas", item: "Torta Castilla", price: 26000, qty: 1 }, { cat: "Cinnamon Rolls", item: "Cinnamon Rolls x 4", price: 26000, qty: 1 }],
    [{ cat: "Tortas", item: "Torta Red Velvet", price: 26000, qty: 2 }],
    [{ cat: "Cinnamon Rolls", item: "Cinnamon Rolls x 6", price: 32000, qty: 2 }],
    [{ cat: "Tortas", item: "Torta Zanahoria", price: 26000, qty: 1 }, { cat: "Cinnamon Rolls", item: "Cinnamon Rolls x 6", price: 32000, qty: 1 }],
    [{ cat: "Tortas", item: "Torta Castilla", price: 26000, qty: 3 }],
  ];

  const rand = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

  const DAYS = 15;
  for (let daysAgo = DAYS; daysAgo >= 0; daysAgo--) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const dateKey = localDateKey(date);
    const isToday = daysAgo === 0;
    const ordersCount = isToday ? randInt(2, 4) : randInt(3, 8);

    // Ensure menu exists for this day
    const menu = await prisma.menu.upsert({
      where: { restaurantId_date: { restaurantId: restaurant.id, date: dateKeyToUtcDate(dateKey) } },
      update: {},
      create: { restaurantId: restaurant.id, date: dateKeyToUtcDate(dateKey), soups: [], proteins: [], sides: [], drinks: [] },
      include: { categories: { include: { items: true } } },
    });

    // Seed categories if empty
    if (menu.categories.length === 0) {
      const PASTELERIA_CATS = [
        { name: "Tortas", items: [{ name: "Torta Castilla", price: 26000 }, { name: "Torta Red Velvet", price: 26000 }, { name: "Torta Zanahoria", price: 26000 }] },
        { name: "Cinnamon Rolls", items: [{ name: "Cinnamon Rolls x 4", price: 26000 }, { name: "Cinnamon Rolls x 6", price: 32000 }] },
      ];
      for (let ci = 0; ci < PASTELERIA_CATS.length; ci++) {
        const c = await prisma.menuCategory.create({ data: { menuId: menu.id, name: PASTELERIA_CATS[ci].name, position: ci } });
        for (let ii = 0; ii < PASTELERIA_CATS[ci].items.length; ii++) {
          await prisma.menuItem.create({ data: { categoryId: c.id, name: PASTELERIA_CATS[ci].items[ii].name, price: PASTELERIA_CATS[ci].items[ii].price, position: ii } });
        }
      }
    }

    const counter = await prisma.dailyOrderCounter.findUnique({ where: { restaurantId_date: { restaurantId: restaurant.id, date: dateKey } } });
    let orderNum = counter?.lastNumber ?? 0;

    for (let j = 0; j < ordersCount; j++) {
      const cust = rand(CUSTOMERS);
      const orderItems = rand(DEMO_ORDERS);
      const customer = await prisma.customer.upsert({
        where: { restaurantId_phone: { restaurantId: restaurant.id, phone: cust.phone } },
        update: { name: cust.name, lastAddress: cust.address },
        create: { restaurantId: restaurant.id, name: cust.name, phone: cust.phone, lastAddress: cust.address },
      });
      orderNum++;
      let status: OrderStatus;
      if (isToday) {
        status = j < 2 ? OrderStatus.PAYMENT_PENDING : OrderStatus.PAYMENT_CONFIRMED;
      } else {
        status = Math.random() < 0.88 ? OrderStatus.PAYMENT_CONFIRMED : OrderStatus.CANCELLED;
      }
      const total = orderItems.reduce((s, i) => s + i.price * i.qty, 0);
      const orderCreatedAt = new Date(date);
      orderCreatedAt.setUTCHours(14 + j % 5, j * 11 % 60, 0, 0);
      await prisma.order.create({
        data: {
          restaurantId: restaurant.id,
          customerId: customer.id,
          customerName: cust.name,
          orderDate: dateKey,
          orderNumber: orderNum,
          status,
          total: new Prisma.Decimal(total),
          address: cust.address,
          createdAt: orderCreatedAt,
          items: {
            create: orderItems.map(i => ({
              soup: "", protein: "", side: "", drink: "",
              price: new Prisma.Decimal(i.price * i.qty),
              catalogCategory: i.cat,
              catalogItem: i.item,
              quantity: i.qty,
              unitPrice: new Prisma.Decimal(i.price),
            })),
          },
        },
      });
    }
    await prisma.dailyOrderCounter.upsert({
      where: { restaurantId_date: { restaurantId: restaurant.id, date: dateKey } },
      update: { lastNumber: orderNum },
      create: { restaurantId: restaurant.id, date: dateKey, lastNumber: orderNum },
    });
  }
  revalidatePath("/admin");
  revalidatePath(`/restaurant/${restaurant.slug}`);
}

/**
 * Admin: populate compelling demo data for ANY restaurant (combo or catalog).
 * Covers every order status — including PAYMENT_REVIEW orders with a sample
 * payment proof — so a full sales demo is possible on any account.
 * Clears existing orders first to avoid duplicates on repeated runs.
 */
export async function populateDemoDataUniversal(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const restaurantId = String(formData.get("restaurantId"));
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, slug: true, basePrice: true, menuType: true },
  });
  if (!restaurant) return { ok: false, message: "Restaurante no encontrado.", ts: Date.now() };

  let totalCreated = 0;
  const SAMPLE_PROOF = "/sample-comprobante.jpg";

  const CUSTOMERS = [
    { name: "Valentina Herrera",  phone: "3101234567", address: "Cra 7 #45-12 Bogotá" },
    { name: "Santiago Morales",   phone: "3152345678", address: "Cll 50 #15-30 apto 201" },
    { name: "Camila Rodríguez",   phone: "3003456789", address: "Cra 15 #80-10 Bogotá" },
    { name: "Felipe Vargas",      phone: "3214567890", address: "Cll 100 #22-15 apto 501" },
    { name: "Daniela Castro",     phone: "3115678901", address: "Cra 30 #63-40 Bogotá" },
    { name: "Andrés Quintero",    phone: "3006789012", address: "Cll 72 #48-20 Bogotá" },
    { name: "Juliana López",      phone: "3177890123", address: "Cra 24 #55-67 of 101" },
    { name: "Mateo Sánchez",      phone: "3028901234", address: "Cll 85 #11-32 Bogotá" },
    { name: "Isabella Torres",    phone: "3159012345", address: "Cra 45 #90-15 Bogotá" },
    { name: "David Jiménez",      phone: "3100123456", address: "Cll 35 #28-50 apto 104" },
    { name: "Sofía Ramírez",      phone: "3171234567", address: "Cra 9 #72-18 Bogotá" },
    { name: "Nicolás Gómez",      phone: "3082345678", address: "Cll 60 #35-25 Bogotá" },
  ];

  const rand = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

  // Additive: no deleteMany — each click accumulates more orders.
  // Counters are read below per-day so order numbers continue from the last value.

  // ── Ensure a menu exists (today's or most recent) ────────────────────────
  const today = dateKeyToUtcDate(localDateKey());
  const todayKey = localDateKey();
  const isCatalog = restaurant.menuType === "catalog";

  // Default combo options when there's no existing menu
  const DEFAULT_COMBO = {
    soups: ["Sancocho de pollo", "Sopa de lentejas", "Crema de ahuyama"],
    proteins: ["Pollo asado", "Carne a la plancha", "Mojarra frita", "Costilla BBQ +3000"],
    sides: ["Frijoles", "Lentejas", "Papa salada", "Ensalada"],
    drinks: ["Jugo de lulo", "Limonada", "Agua panela", "Jugo de maracuyá"],
  };

  // Default catalog categories when there's no existing menu
  const DEFAULT_CATALOG = [
    { name: "Platos principales", items: [{ name: "Especial del día", price: 18000 }, { name: "Bandeja familiar", price: 25000 }, { name: "Combo ejecutivo", price: 15000 }] },
    { name: "Bebidas",            items: [{ name: "Jugo natural", price: 4000 }, { name: "Gaseosa", price: 3000 }, { name: "Agua mineral", price: 2000 }] },
    { name: "Postres",            items: [{ name: "Brownie", price: 5000 }, { name: "Mousse de maracuyá", price: 6000 }] },
  ];

  // Upsert today's menu (keep existing if it already has content)
  const existingMenu = await prisma.menu.findUnique({
    where: { restaurantId_date: { restaurantId: restaurant.id, date: today } },
    include: { categories: { include: { items: true } } },
  });

  let menu = existingMenu;
  if (!menu) {
    menu = await prisma.menu.create({
      data: { restaurantId: restaurant.id, date: today, soups: [], proteins: [], sides: [], drinks: [] },
      include: { categories: { include: { items: true } } },
    });
  }

  // For combo: backfill combo arrays if empty
  if (!isCatalog && existingMenu) {
    const combo = existingMenu as typeof existingMenu & { soups: string[]; proteins: string[]; sides: string[]; drinks: string[] };
    if (!combo.soups.length) {
      await prisma.menu.update({ where: { id: menu.id }, data: DEFAULT_COMBO });
    }
  } else if (!isCatalog) {
    await prisma.menu.update({ where: { id: menu.id }, data: DEFAULT_COMBO });
  }

  // For catalog: backfill categories if empty
  let catalogItems: { categoryName: string; itemName: string; price: number }[] = [];
  if (isCatalog) {
    const cats = existingMenu?.categories ?? [];
    if (cats.length === 0) {
      for (let ci = 0; ci < DEFAULT_CATALOG.length; ci++) {
        const cat = DEFAULT_CATALOG[ci];
        const created = await prisma.menuCategory.create({ data: { menuId: menu.id, name: cat.name, position: ci } });
        for (let ii = 0; ii < cat.items.length; ii++) {
          await prisma.menuItem.create({ data: { categoryId: created.id, name: cat.items[ii].name, price: cat.items[ii].price, position: ii } });
        }
        cat.items.forEach(i => catalogItems.push({ categoryName: cat.name, itemName: i.name, price: i.price }));
      }
    } else {
      catalogItems = cats.flatMap(c => c.items.map(i => ({ categoryName: c.name, itemName: i.name, price: Number(i.price) })));
    }
  }

  // Refresh menu with updated data (needed for combo options after update)
  const freshMenu = await prisma.menu.findUnique({
    where: { id: menu.id },
    include: { categories: { include: { items: true } } },
  }) as (typeof menu & { soups: string[]; proteins: string[]; sides: string[]; drinks: string[] });

  // ── Build order item creators ────────────────────────────────────────────
  function makeComboItems(count: number) {
    return Array.from({ length: count }, () => ({
      soup: rand(freshMenu.soups),
      protein: rand(freshMenu.proteins),
      side: rand(freshMenu.sides),
      drink: rand(freshMenu.drinks),
    }));
  }

  function makeCatalogItems(count: number) {
    const selected = Array.from({ length: count }, () => rand(catalogItems));
    return selected.map(i => ({ categoryName: i.categoryName, itemName: i.itemName, price: i.price, qty: randInt(1, 3) }));
  }

  const basePrice = Number(restaurant.basePrice);

  function comboTotal(items: ReturnType<typeof makeComboItems>): number {
    return items.reduce((s, item) => s + basePrice + itemSurcharge(item.soup, item.protein, item.side, item.drink), 0);
  }

  function catalogTotal(items: ReturnType<typeof makeCatalogItems>): number {
    return items.reduce((s, i) => s + i.price * i.qty, 0);
  }

  function comboOrderItems(items: ReturnType<typeof makeComboItems>) {
    return items.map(item => ({
      soup: item.soup, protein: item.protein, side: item.side, drink: item.drink,
      price: new Prisma.Decimal(basePrice + itemSurcharge(item.soup, item.protein, item.side, item.drink)),
    }));
  }

  function catalogOrderItems(items: ReturnType<typeof makeCatalogItems>) {
    return items.map(i => ({
      soup: "", protein: "", side: "", drink: "",
      catalogCategory: i.categoryName, catalogItem: i.itemName,
      quantity: i.qty, unitPrice: new Prisma.Decimal(i.price),
      price: new Prisma.Decimal(i.price * i.qty),
    }));
  }

  // ── Upsert demo customers ────────────────────────────────────────────────
  const savedCustomers = await Promise.all(
    CUSTOMERS.map(c =>
      prisma.customer.upsert({
        where: { restaurantId_phone: { restaurantId: restaurant.id, phone: c.phone } },
        update: { name: c.name, lastAddress: c.address },
        create: { restaurantId: restaurant.id, name: c.name, phone: c.phone, lastAddress: c.address },
      })
    )
  );

  // ── Generate today's orders: one per status category ────────────────────
  // Statuses and their proof/submission config for a compelling demo view
  // minsAgo: minutes before NOW when the order was created.
  // Using relative time ensures orders look fresh regardless of the time of day.
  type TodaySpec = { status: OrderStatus; proof: boolean; submitted: boolean; minsAgo: number };
  const TODAY_ORDERS: TodaySpec[] = [
    // Very recent — no urgency color yet (< 2 min)
    { status: OrderStatus.NEW,               proof: false, submitted: false, minsAgo: 1  },
    { status: OrderStatus.PAYMENT_PENDING,   proof: false, submitted: false, minsAgo: 3  },
    // Recent pending — showing urgency (3-10 min)
    { status: OrderStatus.PAYMENT_PENDING,   proof: false, submitted: false, minsAgo: 7  },
    // PAYMENT_REVIEW × 4 — the key demo category, spread over last 5-30 min
    { status: OrderStatus.PAYMENT_REVIEW,    proof: true,  submitted: true,  minsAgo: 5  },
    { status: OrderStatus.PAYMENT_REVIEW,    proof: true,  submitted: true,  minsAgo: 10 },
    { status: OrderStatus.PAYMENT_REVIEW,    proof: true,  submitted: true,  minsAgo: 18 },
    { status: OrderStatus.PAYMENT_REVIEW,    proof: true,  submitted: true,  minsAgo: 28 },
    // Older today orders — context for the day
    { status: OrderStatus.PAYMENT_REJECTED,  proof: true,  submitted: true,  minsAgo: 50 },
    { status: OrderStatus.PAYMENT_CONFIRMED, proof: true,  submitted: true,  minsAgo: 65 },
    { status: OrderStatus.PAYMENT_CONFIRMED, proof: true,  submitted: true,  minsAgo: 85 },
    { status: OrderStatus.PAYMENT_CONFIRMED, proof: true,  submitted: true,  minsAgo: 110},
    { status: OrderStatus.CANCELLED,         proof: false, submitted: false,  minsAgo: 70 },
  ];

  // Continue from the last order number for today (additive).
  const todayCounter = await prisma.dailyOrderCounter.findUnique({
    where: { restaurantId_date: { restaurantId: restaurant.id, date: todayKey } },
  });
  let orderNum = todayCounter?.lastNumber ?? 0;

  for (let j = 0; j < TODAY_ORDERS.length; j++) {
    const spec = TODAY_ORDERS[j];
    const cust = savedCustomers[j % savedCustomers.length];
    // createdAt = NOW minus minsAgo — always relative to the current moment.
    const createdAt = new Date(Date.now() - spec.minsAgo * 60_000);
    orderNum++;

    const comboItems = isCatalog ? [] : makeComboItems(randInt(1, 2));
    const catItems   = isCatalog ? makeCatalogItems(randInt(1, 3)) : [];
    const total      = isCatalog ? catalogTotal(catItems) : comboTotal(comboItems);

    await prisma.order.create({
      data: {
        restaurantId: restaurant.id,
        customerId: cust.id,
        customerName: cust.name,
        orderDate: todayKey,
        orderNumber: orderNum,
        status: spec.status,
        total: new Prisma.Decimal(total),
        address: cust.lastAddress,
        fulfillment: "delivery",
        createdAt,
        ...(spec.submitted ? { paymentSubmittedAt: createdAt } : {}),
        ...(spec.proof ? { paymentProofPath: SAMPLE_PROOF } : {}),
        items: { create: isCatalog ? catalogOrderItems(catItems) : comboOrderItems(comboItems) },
      },
    });
    totalCreated++;
  }
  await prisma.dailyOrderCounter.upsert({
    where: { restaurantId_date: { restaurantId: restaurant.id, date: todayKey } },
    update: { lastNumber: orderNum },
    create: { restaurantId: restaurant.id, date: todayKey, lastNumber: orderNum },
  });

  // ── Historical orders: last 15 days ─────────────────────────────────────
  const DAYS = 15;
  for (let daysAgo = DAYS; daysAgo >= 1; daysAgo--) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const dateKey = localDateKey(date);
    const count = randInt(4, 8);

    // Ensure menu exists for past days too
    await prisma.menu.upsert({
      where: { restaurantId_date: { restaurantId: restaurant.id, date: dateKeyToUtcDate(dateKey) } },
      update: {},
      create: isCatalog
        ? { restaurantId: restaurant.id, date: dateKeyToUtcDate(dateKey), soups: [], proteins: [], sides: [], drinks: [] }
        : { restaurantId: restaurant.id, date: dateKeyToUtcDate(dateKey), ...DEFAULT_COMBO },
    });

    const histCounter = await prisma.dailyOrderCounter.findUnique({
      where: { restaurantId_date: { restaurantId: restaurant.id, date: dateKey } },
    });
    let histNum = histCounter?.lastNumber ?? 0;

    for (let j = 0; j < count; j++) {
      const cust = savedCustomers[Math.floor(Math.random() * savedCustomers.length)];
      const status = Math.random() < 0.85 ? OrderStatus.PAYMENT_CONFIRMED : OrderStatus.CANCELLED;
      const comboItems = isCatalog ? [] : makeComboItems(randInt(1, 2));
      const catItems   = isCatalog ? makeCatalogItems(randInt(1, 3)) : [];
      const total      = isCatalog ? catalogTotal(catItems) : comboTotal(comboItems);
      // UTC 16-19 = 11am-2pm Bogotá (UTC-5) — realistic lunch service hours.
      const createdAt  = new Date(date);
      createdAt.setUTCHours(16 + j % 4, j * 9 % 60, 0, 0);
      histNum++;

      await prisma.order.create({
        data: {
          restaurantId: restaurant.id,
          customerId: cust.id,
          customerName: cust.name,
          orderDate: dateKey,
          orderNumber: histNum,
          status,
          total: new Prisma.Decimal(total),
          address: cust.lastAddress,
          fulfillment: "delivery",
          createdAt,
          paymentSubmittedAt: status === OrderStatus.PAYMENT_CONFIRMED ? createdAt : undefined,
          paymentProofPath: status === OrderStatus.PAYMENT_CONFIRMED ? SAMPLE_PROOF : undefined,
          items: { create: isCatalog ? catalogOrderItems(catItems) : comboOrderItems(comboItems) },
        },
      });
      totalCreated++;
    }
    await prisma.dailyOrderCounter.upsert({
      where: { restaurantId_date: { restaurantId: restaurant.id, date: dateKey } },
      update: { lastNumber: histNum },
      create: { restaurantId: restaurant.id, date: dateKey, lastNumber: histNum },
    });
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/restaurants/${restaurant.slug}`);
  revalidatePath(`/restaurant/${restaurant.slug}`);
  revalidatePath(`/restaurant/${restaurant.slug}/orders`);
  revalidatePath(`/restaurant/${restaurant.slug}/analytics`);
  revalidatePath(`/restaurant/${restaurant.slug}/history`);

  return {
    ok: true,
    message: `✓ Se agregaron ${totalCreated} pedidos (${TODAY_ORDERS.length} de hoy + ${totalCreated - TODAY_ORDERS.length} históricos).`,
    ts: Date.now(),
  };
}

/** Admin: activate or renew a restaurant's subscription. */
export async function setRestaurantSubscription(formData: FormData) {
  await requireAdmin();

  const restaurantId = String(formData.get("restaurantId"));
  const mode = String(formData.get("mode") ?? "renew");

  if (mode === "set-date") {
    // Manual override: set a specific end date regardless of current state
    const endDateRaw = String(formData.get("endDate"));
    const endDate = new Date(`${endDateRaw}T23:59:59.000Z`);
    if (isNaN(endDate.getTime())) throw new Error("Fecha inválida.");
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { subscriptionEndsAt: endDate },
    });
    revalidatePath("/admin");
    return;
  }

  // mode === "renew": standard +30 days renewal from the correct base
  const paymentDate = new Date(String(formData.get("paymentDate")));
  if (isNaN(paymentDate.getTime())) throw new Error("Fecha de pago inválida.");

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { subscriptionEndsAt: true },
  });

  const { calculateNewSubscriptionEnd } = await import("@/lib/subscription");
  // Always computes from paymentDate, ignoring current endsAt.
  // This prevents the "keeps adding 30 days on each click" bug.
  const newEndsAt = calculateNewSubscriptionEnd(paymentDate);

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { subscriptionStartedAt: paymentDate, subscriptionEndsAt: newEndsAt },
  });
  revalidatePath("/admin");
}

/** Admin: update a customer's name, phone and last address. */
export async function updateCustomer(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("customerId"));
  const name = required(String(formData.get("name") ?? ""), "nombre");
  const phone = String(formData.get("phone") ?? "").replace(/\D/g, "").slice(0, 15);
  if (!phone) throw new Error("Teléfono inválido.");
  const lastAddress = String(formData.get("lastAddress") ?? "").trim();
  const restaurantSlug = String(formData.get("restaurantSlug") ?? "");

  await prisma.customer.update({ where: { id }, data: { name, phone, lastAddress } });
  revalidatePath(`/admin/customers/${restaurantSlug}`);
}

/** Admin: delete a customer and ALL their orders (no order history preserved). */
export async function deleteCustomer(formData: FormData) {
  await requireAdmin();

  const customerId = String(formData.get("customerId"));
  const restaurantSlug = String(formData.get("restaurantSlug") ?? "");

  // Must delete orders first (onDelete: Restrict on Customer relation)
  await prisma.$transaction([
    prisma.order.deleteMany({ where: { customerId } }),
    prisma.customer.delete({ where: { id: customerId } }),
  ]);
  revalidatePath(`/admin/customers/${restaurantSlug}`);
}

/** Admin: permanently delete a restaurant and ALL its data. Requires slug confirmation. */
export async function deleteRestaurant(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return UNAUTHORIZED();

  const restaurantId = String(formData.get("restaurantId"));
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();

  if (confirmation !== slug) {
    return { ok: false, message: "La confirmación no coincide con el slug.", ts: Date.now() };
  }

  await prisma.restaurant.delete({ where: { id: restaurantId } });
  redirect("/admin");
}

/** Admin: immediately deactivate a restaurant's subscription (no grace period). */
export async function deactivateRestaurantSubscription(formData: FormData) {
  await requireAdmin();

  const restaurantId = String(formData.get("restaurantId"));
  // Set endsAt to one day in the past — guaranteed to be in the past regardless
  // of any clock skew, and the middleware check (now > endsAt) fires immediately.
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { subscriptionEndsAt: yesterday },
  });
  revalidatePath("/admin");
}

/** Admin: set or reset a restaurant's password. */
export async function setRestaurantPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return UNAUTHORIZED();
  const restaurantId = String(formData.get("restaurantId"));
  const password = String(formData.get("password") ?? "").trim();
  if (password.length < 8) {
    return { ok: false, message: "La contraseña debe tener al menos 8 caracteres.", ts: Date.now() };
  }

  const { hash } = await import("bcryptjs");
  const passwordHash = await hash(password, 12);
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { passwordHash } });
  revalidatePath("/admin");
  return { ok: true, message: "Contraseña actualizada.", ts: Date.now() };
}

// ─────────────────────────────────────────────────────────
// Restaurant users (admin-only — restaurants cannot manage
// their own operator accounts)
// ─────────────────────────────────────────────────────────

/** Admin: create an additional operator account for a restaurant. */
export async function createRestaurantUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return UNAUTHORIZED();

  const restaurantId = String(formData.get("restaurantId"));
  const username = String(formData.get("username") ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!username || username.length < 3)
    return { ok: false, message: "El usuario debe tener al menos 3 caracteres.", ts: Date.now() };
  if (username.length > 50)
    return { ok: false, message: "El usuario es demasiado largo (máx. 50 caracteres).", ts: Date.now() };
  if (password.length < 8)
    return { ok: false, message: "La contraseña debe tener al menos 8 caracteres.", ts: Date.now() };

  const existing = await prisma.restaurantUser.findUnique({ where: { username } });
  if (existing) return { ok: false, message: `El usuario "${username}" ya está en uso.`, ts: Date.now() };

  const { hash } = await import("bcryptjs");
  const passwordHash = await hash(password, 12);

  await prisma.restaurantUser.create({
    data: { restaurantId, username, passwordHash, displayName },
  });

  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { slug: true } });
  revalidatePath("/admin");
  if (restaurant) revalidatePath(`/admin/restaurants/${restaurant.slug}`);
  return { ok: true, message: `Usuario "${username}" creado.`, ts: Date.now() };
}

/** Admin: delete a restaurant operator account. */
export async function deleteRestaurantUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return UNAUTHORIZED();

  const userId = String(formData.get("userId"));
  const user = await prisma.restaurantUser.findUnique({
    where: { id: userId },
    select: { username: true, restaurant: { select: { slug: true } } },
  });
  if (!user) return { ok: false, message: "Usuario no encontrado.", ts: Date.now() };

  await prisma.restaurantUser.delete({ where: { id: userId } });
  revalidatePath("/admin");
  revalidatePath(`/admin/restaurants/${user.restaurant.slug}`);
  return { ok: true, message: `Usuario "${user.username}" eliminado.`, ts: Date.now() };
}

/** Admin: reset an operator account's password. */
export async function resetRestaurantUserPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return UNAUTHORIZED();

  const userId = String(formData.get("userId"));
  const password = String(formData.get("password") ?? "").trim();
  if (password.length < 8)
    return { ok: false, message: "La contraseña debe tener al menos 8 caracteres.", ts: Date.now() };

  const user = await prisma.restaurantUser.findUnique({
    where: { id: userId },
    select: { restaurant: { select: { slug: true } } },
  });
  if (!user) return { ok: false, message: "Usuario no encontrado.", ts: Date.now() };

  const { hash } = await import("bcryptjs");
  await prisma.restaurantUser.update({
    where: { id: userId },
    data: { passwordHash: await hash(password, 12) },
  });

  revalidatePath(`/admin/restaurants/${user.restaurant.slug}`);
  return { ok: true, message: "Contraseña actualizada.", ts: Date.now() };
}

/** Admin: toggle active status of an operator account. */
export async function toggleRestaurantUserActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return UNAUTHORIZED();

  const userId = String(formData.get("userId"));
  const user = await prisma.restaurantUser.findUnique({
    where: { id: userId },
    select: { active: true, restaurant: { select: { slug: true } } },
  });
  if (!user) return { ok: false, message: "Usuario no encontrado.", ts: Date.now() };

  await prisma.restaurantUser.update({ where: { id: userId }, data: { active: !user.active } });
  revalidatePath(`/admin/restaurants/${user.restaurant.slug}`);
  return { ok: true, message: user.active ? "Usuario desactivado." : "Usuario activado.", ts: Date.now() };
}

/** Restaurant: change their own password (requires current password). */
export type ChangePasswordState = { error: string; success: boolean };
export async function changePasswordAction(
  _: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  try {
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session || session.role !== "restaurant" || !session.restaurantSlug) {
      return { error: "No autorizado.", success: false };
    }

    const current  = String(formData.get("currentPassword") ?? "");
    const next     = String(formData.get("newPassword") ?? "").trim();
    const confirm  = String(formData.get("confirmPassword") ?? "").trim();

    if (next.length < 8) return { error: "La nueva contraseña debe tener al menos 8 caracteres.", success: false };
    if (next !== confirm)  return { error: "Las contraseñas no coinciden.", success: false };

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug: session.restaurantSlug },
      select: { id: true, passwordHash: true },
    });
    if (!restaurant) return { error: "Restaurante no encontrado.", success: false };

    if (restaurant.passwordHash) {
      const { compare } = await import("bcryptjs");
      if (!(await compare(current, restaurant.passwordHash))) {
        return { error: "La contraseña actual es incorrecta.", success: false };
      }
    }

    const { hash } = await import("bcryptjs");
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { passwordHash: await hash(next, 12) },
    });
    revalidatePath(`/restaurant/${session.restaurantSlug}`);
    return { error: "", success: true };
  } catch {
    return { error: "No se pudo cambiar la contraseña.", success: false };
  }
}

export type ActionState = { ok: boolean; message: string; ts: number; data?: Record<string, string | null> };
export type MenuFormState = ActionState;

export async function updateTodayMenu(_prev: MenuFormState, formData: FormData): Promise<MenuFormState> {
  const restaurantId = String(formData.get("restaurantId"));
  const auth = await canManageRestaurantById(restaurantId);
  if (!auth) return UNAUTHORIZED();
  const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
  const menu = {
    soups: splitOptions(formData.get("soups")),
    proteins: splitOptions(formData.get("proteins")),
    sides: splitOptions(formData.get("sides")),
    drinks: splitOptions(formData.get("drinks")),
  };
  if (Object.values(menu).some((options) => !options.length)) {
    return { ok: false, message: "Cada categoría necesita al menos una opción.", ts: Date.now() };
  }
  if (Object.values(menu).flat().some((option) => option.length > MAX_MENU_OPTION_LEN)) {
    return { ok: false, message: `Cada opción debe tener máximo ${MAX_MENU_OPTION_LEN} caracteres.`, ts: Date.now() };
  }

  await prisma.menu.upsert({
    where: {
      restaurantId_date: {
        restaurantId,
        date: dateKeyToUtcDate(localDateKey()),
      },
    },
    update: menu,
    create: {
      restaurantId,
      date: dateKeyToUtcDate(localDateKey()),
      ...menu,
    },
  });
  revalidatePath("/admin");
  revalidatePath(returnPath);
  // No redirect: returning state keeps scroll position and lets the client show
  // a confirmation toast. revalidatePath refreshes the data in place.
  return { ok: true, message: "Menú publicado y visible para tus clientes.", ts: Date.now() };
}

/** Remove today's published menu so customers see the "no menu yet" state. */
export async function unpublishTodayMenu(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const restaurantId = String(formData.get("restaurantId"));
  const auth = await canManageRestaurantById(restaurantId);
  if (!auth) return UNAUTHORIZED();
  const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
  await prisma.menu.deleteMany({
    where: { restaurantId, date: dateKeyToUtcDate(localDateKey()) },
  });
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { slug: true } });
  revalidatePath("/admin");
  revalidatePath(returnPath);
  if (restaurant) revalidatePath(`/r/${restaurant.slug}`);
  return { ok: true, message: "Menú despublicado. Tus clientes ya no lo ven.", ts: Date.now() };
}

export async function updateBasePrice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const restaurantId = String(formData.get("restaurantId"));
  const auth = await canManageRestaurantById(restaurantId);
  if (!auth) return UNAUTHORIZED();
  const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
  const basePrice = Number(formData.get("basePrice"));
  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    return { ok: false, message: "Ingresa un precio válido mayor a 0.", ts: Date.now() };
  }

  const restaurant = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { basePrice },
    select: { slug: true },
  });
  revalidatePath("/admin");
  revalidatePath(returnPath);
  revalidatePath(`/r/${restaurant.slug}`);
  return { ok: true, message: "Precio actualizado.", ts: Date.now() };
}

export async function updateBusinessPhone(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const restaurantId = String(formData.get("restaurantId"));
  const auth = await canManageRestaurantById(restaurantId);
  if (!auth) return UNAUTHORIZED();
  const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
  const whatsappPhone = String(formData.get("whatsappPhone") ?? "").replace(/\D/g, "").slice(0, 15) || null;

  const restaurant = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { whatsappPhone },
    select: { slug: true },
  });
  revalidatePath("/admin");
  revalidatePath(returnPath);
  revalidatePath(`/r/${restaurant.slug}`);
  return { ok: true, message: "Número guardado.", ts: Date.now() };
}

export async function updateLogo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const restaurantId = String(formData.get("restaurantId"));
    const auth = await canManageRestaurantById(restaurantId);
    if (!auth) return UNAUTHORIZED();
    const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
    const file = formData.get("logo");
    let logoPath: string | null = null;
    try {
      logoPath = file instanceof File ? await saveUpload(file, "logo") : null;
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "No se pudo subir el logo.", ts: Date.now() };
    }
    if (!logoPath) {
      return { ok: false, message: "Sube una imagen de logo (PNG, JPG o WEBP).", ts: Date.now() };
    }

    const restaurant = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { logoPath },
      select: { slug: true },
    });
    revalidatePath("/admin");
    revalidatePath(returnPath);
    revalidatePath(`/r/${restaurant.slug}`);
    return { ok: true, message: "Logo actualizado.", ts: Date.now() };
  } catch (e) {
    logger.error("update_logo_failed", { err: e });
    return { ok: false, message: "No se pudo guardar el logo. Intenta de nuevo.", ts: Date.now() };
  }
}

export async function updateDeliverySettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const restaurantId = String(formData.get("restaurantId"));
  const auth = await canManageRestaurantById(restaurantId);
  if (!auth) return UNAUTHORIZED();
  const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
  const modeRaw = String(formData.get("deliveryMode") ?? "separate");
  const deliveryMode = ["free", "fixed", "separate"].includes(modeRaw) ? modeRaw : "separate";
  const allowPickup = formData.get("allowPickup") != null;
  const note = String(formData.get("deliveryNote") ?? "").trim() || null;

  let deliveryFee: number | null = null;
  if (deliveryMode === "fixed") {
    const fee = Number(formData.get("deliveryFee"));
    if (!Number.isFinite(fee) || fee < 0) {
      return { ok: false, message: "Ingresa un valor de domicilio válido.", ts: Date.now() };
    }
    deliveryFee = fee;
  }

  const restaurant = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { deliveryMode, deliveryFee, deliveryNote: note, allowPickup },
    select: { slug: true },
  });
  revalidatePath("/admin");
  revalidatePath(returnPath);
  revalidatePath(`/r/${restaurant.slug}`);
  return { ok: true, message: "Opciones de entrega guardadas.", ts: Date.now() };
}

/** Remove the custom logo so the restaurant falls back to the default logo. */
export async function resetLogo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const restaurantId = String(formData.get("restaurantId"));
  const auth = await canManageRestaurantById(restaurantId);
  if (!auth) return UNAUTHORIZED();
  const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
  const restaurant = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { logoPath: null },
    select: { slug: true },
  });
  revalidatePath("/admin");
  revalidatePath(returnPath);
  revalidatePath(`/r/${restaurant.slug}`);
  return { ok: true, message: "Logo por defecto restaurado.", ts: Date.now() };
}

export async function updatePaymentSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const restaurantId = String(formData.get("restaurantId"));
  const auth = await canManageRestaurantById(restaurantId);
  if (!auth) return UNAUTHORIZED();
  const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
  const nequiAccountName = String(formData.get("nequiAccountName") ?? "").trim();
  const nequiPhone = String(formData.get("nequiPhone") ?? "").trim();
  if (!nequiAccountName || !nequiPhone) {
    return { ok: false, message: "Completa el titular y el número o llave Nequi.", ts: Date.now() };
  }
  const file = formData.get("nequiQr");
  let nequiQrPath: string | null = null;
  try {
    nequiQrPath = file instanceof File ? await saveUpload(file, "nequi-qr") : null;
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "No se pudo subir el QR.", ts: Date.now() };
  }

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      nequiAccountName,
      nequiPhone,
      ...(nequiQrPath ? { nequiQrPath } : {}),
    },
  });
  revalidatePath("/admin");
  revalidatePath(returnPath);
  return { ok: true, message: "Datos de Nequi guardados.", ts: Date.now() };
}

export async function updateMenuTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const restaurantId = String(formData.get("restaurantId"));
    const auth = await canManageRestaurantById(restaurantId);
    if (!auth) return UNAUTHORIZED();
    const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
    const file = formData.get("menuTemplate");

    let menuTemplatePath: string | null = null;
    try {
      menuTemplatePath = file instanceof File ? await saveUpload(file, "menu-template") : null;
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "No se pudo subir la plantilla.", ts: Date.now() };
    }
    if (!menuTemplatePath) {
      return { ok: false, message: "Sube una imagen de plantilla (PNG, JPG o WEBP) de 1080×1350.", ts: Date.now() };
    }

    const current = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { slug: true, menuTemplateHistory: true } });
    const history = [menuTemplatePath, ...(current?.menuTemplateHistory ?? []).filter((p) => p !== menuTemplatePath)].slice(0, 4);

    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { menuTemplatePath, menuTemplateHistory: history },
    });
    revalidatePath("/admin");
    revalidatePath(returnPath);
    if (current) revalidatePath(`/r/${current.slug}`);
    return { ok: true, message: "Plantilla actualizada.", ts: Date.now() };
  } catch (e) {
    logger.error("update_menu_template_failed", { err: e });
    return { ok: false, message: "No se pudo guardar la plantilla. Intenta de nuevo.", ts: Date.now() };
  }
}

/** Update the description and optional photo of a catalog menu item. */
export async function toggleCustomerFavorite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const customerId = String(formData.get("customerId"));
    const owner = await canManageCustomer(customerId);
    if (!owner) return UNAUTHORIZED();
    const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
    const current = await prisma.customer.findUnique({ where: { id: customerId }, select: { favorite: true } });
    if (!current) return { ok: false, message: "Cliente no encontrado.", ts: Date.now() };
    await prisma.customer.update({ where: { id: customerId }, data: { favorite: !current.favorite } });
    revalidatePath(returnPath);
    return { ok: true, message: current.favorite ? "Favorito eliminado." : "Marcado como favorito.", ts: Date.now() };
  } catch (e) {
    logger.error("toggle_customer_favorite_failed", { err: e });
    return { ok: false, message: "No se pudo actualizar.", ts: Date.now() };
  }
}

export async function updateMenuItemDetails(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const itemId = String(formData.get("itemId"));
    const owner = await canManageMenuItem(itemId);
    if (!owner) return UNAUTHORIZED();
    const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
    const description = String(formData.get("description") ?? "").trim() || null;
    if (description && description.length > MAX_ITEM_DESCRIPTION_LEN) {
      return { ok: false, message: `La descripción debe tener máximo ${MAX_ITEM_DESCRIPTION_LEN} caracteres.`, ts: Date.now() };
    }
    const clearImage = formData.get("clearImage") === "1";
    const file = formData.get("image");
    let imagePath: string | null | undefined = undefined;
    if (clearImage) {
      imagePath = null; // explicitly clear
    } else if (file instanceof File && file.size > 0) {
      try {
        imagePath = await saveUpload(file, "menu-item");
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : "No se pudo subir la imagen.", ts: Date.now() };
      }
    }
    await prisma.menuItem.update({
      where: { id: itemId },
      data: {
        description,
        ...(imagePath !== undefined ? { imagePath } : {}),
      },
    });
    revalidatePath(returnPath);
    // Return the final imagePath so the client can update its local state
    // without a router.refresh() (which resets the CatalogMenuEditor state).
    const finalImagePath = imagePath !== undefined
      ? imagePath
      : (await prisma.menuItem.findUnique({ where: { id: itemId }, select: { imagePath: true } }))?.imagePath ?? null;
    return { ok: true, message: "Detalles actualizados.", ts: Date.now(), data: { imagePath: finalImagePath } };
  } catch (e) {
    logger.error("update_menu_item_details_failed", { err: e });
    return { ok: false, message: "No se pudo guardar los detalles.", ts: Date.now() };
  }
}

/** Clear the upload history so the 4 default presets are shown again. */
export async function resetMenuTemplates(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const restaurantId = String(formData.get("restaurantId"));
  const auth = await canManageRestaurantById(restaurantId);
  if (!auth) return UNAUTHORIZED();
  const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { menuTemplateHistory: [] } });
  revalidatePath("/admin");
  revalidatePath(returnPath);
  return { ok: true, message: "Plantillas predeterminadas restauradas.", ts: Date.now() };
}

/** Select an existing template (a preset or one from the upload history). */
export async function selectMenuTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const restaurantId = String(formData.get("restaurantId"));
  const auth = await canManageRestaurantById(restaurantId);
  if (!auth) return UNAUTHORIZED();
  const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
  const templatePath = String(formData.get("templatePath") ?? "");

  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { slug: true, menuTemplateHistory: true } });
  if (!restaurant) return { ok: false, message: "Restaurante no encontrado.", ts: Date.now() };

  const { PRESET_TEMPLATES } = await import("@/lib/menu-image/template-spec");
  const allowed = new Set<string>([...restaurant.menuTemplateHistory, ...PRESET_TEMPLATES]);
  if (!allowed.has(templatePath)) return { ok: false, message: "Plantilla no válida.", ts: Date.now() };

  await prisma.restaurant.update({ where: { id: restaurantId }, data: { menuTemplatePath: templatePath } });
  revalidatePath("/admin");
  revalidatePath(returnPath);
  revalidatePath(`/r/${restaurant.slug}`);
  return { ok: true, message: "Plantilla seleccionada.", ts: Date.now() };
}

export async function createPaymentMethod(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const restaurantId = String(formData.get("restaurantId"));
  const auth = await canManageRestaurantById(restaurantId);
  if (!auth) return UNAUTHORIZED();
  const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
  const label = String(formData.get("label") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const accountName = String(formData.get("accountName") ?? "").trim();
  const isBank = formData.get("isBank") != null;
  const accountType = isBank ? (String(formData.get("accountType") ?? "").trim() || null) : null;
  const idNumber = isBank ? (String(formData.get("idNumber") ?? "").trim() || null) : null;
  if (!label || !phone || !accountName) {
    return { ok: false, message: "Completa el tipo, el número y el titular.", ts: Date.now() };
  }
  if (isBank && (!accountType || !idNumber)) {
    return { ok: false, message: "Para cuentas bancarias indica el tipo de cuenta y la cédula.", ts: Date.now() };
  }

  const file = formData.get("qr");
  let qrPath: string | null = null;
  try {
    qrPath = file instanceof File ? await saveUpload(file, "payment-qr") : null;
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "No se pudo subir el QR.", ts: Date.now() };
  }

  const count = await prisma.paymentMethod.count({ where: { restaurantId } });
  await prisma.paymentMethod.create({
    data: { restaurantId, label, phone, accountName, accountType, idNumber, qrPath, position: count },
  });
  revalidatePath("/admin");
  revalidatePath(returnPath);
  return { ok: true, message: "Método de pago agregado.", ts: Date.now() };
}

export async function deletePaymentMethod(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id"));
  const restaurantId = String(formData.get("restaurantId"));
  const auth = await canManageRestaurantById(restaurantId);
  if (!auth) return UNAUTHORIZED();
  const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");

  const method = await prisma.paymentMethod.findFirst({ where: { id, restaurantId } });
  if (!method) return { ok: false, message: "Método de pago no encontrado.", ts: Date.now() };
  await prisma.paymentMethod.delete({ where: { id } });
  revalidatePath("/admin");
  revalidatePath(returnPath);
  return { ok: true, message: "Método de pago eliminado.", ts: Date.now() };
}

export type PaymentProofState = { error: string; success: boolean };

export async function uploadPaymentProof(_: PaymentProofState, formData: FormData): Promise<PaymentProofState> {
  const restaurantSlug = String(formData.get("restaurantSlug"));
  const publicToken = String(formData.get("publicToken"));
  try {
    const file = formData.get("paymentProof");
    if (!(file instanceof File)) throw new Error("Selecciona un comprobante.");
    const paymentProofPath = await saveUpload(file, "payment-proof");
    if (!paymentProofPath) throw new Error("Selecciona un comprobante.");

    const order = await prisma.order.findFirst({
      where: { publicToken, restaurant: { slug: restaurantSlug } },
    });
    if (!order) throw new Error("Pedido no encontrado.");

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentProofPath,
        paymentSubmittedAt: new Date(),
        status: OrderStatus.PAYMENT_REVIEW,
      },
    });
    revalidatePath(`/restaurant/${restaurantSlug}/orders`);
    revalidatePath(`/r/${restaurantSlug}/orders/${publicToken}`);
    revalidatePath("/admin");
    logger.info("payment_proof_uploaded", { restaurantSlug });
    return { error: "", success: true };
  } catch (cause) {
    logger.warn("payment_proof_upload_failed", { restaurantSlug, err: cause });
    return {
      error: cause instanceof Error ? cause.message : "No pudimos guardar el comprobante.",
      success: false,
    };
  }
}

// ─────────────────────────────────────────────────────────
// Catalog menu (menuType = "catalog") — dynamic categories
// ─────────────────────────────────────────────────────────

export type CatalogCategory = {
  id?: string;
  name: string;
  items: { id?: string; name: string; price: number; description?: string | null; imagePath?: string | null }[];
};

export type CatalogMenuState = { ok: boolean; message: string; ts: number };

/** Upsert today's catalog menu (dynamic categories + items with per-item prices). */
export async function updateCatalogMenu(
  _prev: CatalogMenuState,
  formData: FormData,
): Promise<CatalogMenuState> {
  try {
    const restaurantId = String(formData.get("restaurantId"));
    const auth = await canManageRestaurantById(restaurantId);
    if (!auth) return UNAUTHORIZED();
    const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
    const rawCategories = String(formData.get("categories") ?? "[]");

    let categories: CatalogCategory[];
    try {
      categories = JSON.parse(rawCategories);
    } catch {
      return { ok: false, message: "Datos del menú inválidos.", ts: Date.now() };
    }

    if (!categories.length) {
      return { ok: false, message: "Agrega al menos una categoría.", ts: Date.now() };
    }
    for (const cat of categories) {
      if (!cat.name.trim()) return { ok: false, message: "Todas las categorías deben tener nombre.", ts: Date.now() };
      if (cat.name.length > MAX_CATEGORY_NAME_LEN) return { ok: false, message: `El nombre de categoría "${cat.name.slice(0, 20)}…" es demasiado largo.`, ts: Date.now() };
      if (!cat.items.length) return { ok: false, message: `La categoría "${cat.name}" no tiene productos.`, ts: Date.now() };
      for (const item of cat.items) {
        if (!item.name.trim()) return { ok: false, message: `Un producto en "${cat.name}" no tiene nombre.`, ts: Date.now() };
        if (item.name.length > MAX_ITEM_NAME_LEN) return { ok: false, message: `Un producto en "${cat.name}" tiene un nombre demasiado largo.`, ts: Date.now() };
        if (!Number.isFinite(item.price) || item.price < 0) return { ok: false, message: `Precio inválido en "${cat.name}".`, ts: Date.now() };
      }
    }

    const today = dateKeyToUtcDate(localDateKey());

    // Upsert the Menu row for today.
    const menu = await prisma.menu.upsert({
      where: { restaurantId_date: { restaurantId, date: today } },
      update: {},
      create: { restaurantId, date: today, soups: [], proteins: [], sides: [], drinks: [] },
      include: { categories: { include: { items: true } } },
    });

    // Capture description + imagePath of existing items BEFORE deleting, keyed by
    // "categoryName::itemName" (lowercased). The delete-and-recreate strategy would
    // otherwise silently discard any photos/descriptions added via updateMenuItemDetails.
    const existingCats = await prisma.menuCategory.findMany({
      where: { menuId: menu.id },
      include: { items: { select: { name: true, description: true, imagePath: true } } },
    });
    const savedDetails = new Map<string, { description: string | null; imagePath: string | null }>();
    for (const cat of existingCats) {
      for (const item of cat.items) {
        const key = `${cat.name.toLowerCase().trim()}::${item.name.toLowerCase().trim()}`;
        savedDetails.set(key, { description: item.description, imagePath: item.imagePath });
      }
    }

    // Replace all categories: delete existing, recreate from submitted data.
    await prisma.menuCategory.deleteMany({ where: { menuId: menu.id } });
    for (let ci = 0; ci < categories.length; ci++) {
      const cat = categories[ci];
      const created = await prisma.menuCategory.create({
        data: { menuId: menu.id, name: cat.name.trim(), position: ci },
      });
      for (let ii = 0; ii < cat.items.length; ii++) {
        const item = cat.items[ii];
        const key = `${cat.name.toLowerCase().trim()}::${item.name.toLowerCase().trim()}`;
        const saved = savedDetails.get(key);
        await prisma.menuItem.create({
          data: {
            categoryId: created.id,
            name: item.name.trim(),
            price: new Prisma.Decimal(item.price),
            position: ii,
            description: saved?.description ?? null,
            imagePath: saved?.imagePath ?? null,
          },
        });
      }
    }

    revalidatePath("/admin");
    revalidatePath(returnPath);
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { slug: true } });
    if (restaurant) revalidatePath(`/r/${restaurant.slug}`);
    return { ok: true, message: "Menú publicado y visible para tus clientes.", ts: Date.now() };
  } catch (e) {
    logger.error("update_catalog_menu_failed", { err: e });
    return { ok: false, message: "No se pudo guardar el menú. Intenta de nuevo.", ts: Date.now() };
  }
}

/** Unpublish today's catalog menu (same as combo unpublish). */
export async function unpublishCatalogMenu(
  _prev: CatalogMenuState,
  formData: FormData,
): Promise<CatalogMenuState> {
  try {
    const restaurantId = String(formData.get("restaurantId"));
    const auth = await canManageRestaurantById(restaurantId);
    if (!auth) return UNAUTHORIZED();
    const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
    await prisma.menu.deleteMany({ where: { restaurantId, date: dateKeyToUtcDate(localDateKey()) } });
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { slug: true } });
    revalidatePath("/admin");
    revalidatePath(returnPath);
    if (restaurant) revalidatePath(`/r/${restaurant.slug}`);
    return { ok: true, message: "Menú despublicado. Tus clientes ya no lo ven.", ts: Date.now() };
  } catch (e) {
    logger.error("unpublish_catalog_menu_failed", { err: e });
    return { ok: false, message: "No se pudo despublicar el menú.", ts: Date.now() };
  }
}

/** Switch a restaurant's menu type between "combo" and "catalog". */
export async function updateMenuType(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const restaurantId = String(formData.get("restaurantId"));
    const auth = await canManageRestaurantById(restaurantId);
    if (!auth) return UNAUTHORIZED();
    const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
    const menuType = formData.get("menuType") === "catalog" ? "catalog" : "combo";
    const orderUnitLabel = String(formData.get("orderUnitLabel") ?? "almuerzo").trim() || "almuerzo";
    const basePriceRaw = Number(formData.get("basePrice"));
    const basePrice = menuType === "combo" && Number.isFinite(basePriceRaw) && basePriceRaw >= 0
      ? new Prisma.Decimal(basePriceRaw) : undefined;
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { menuType, orderUnitLabel, ...(basePrice !== undefined ? { basePrice } : {}) },
    });
    revalidatePath("/admin");
    revalidatePath(returnPath);
    return { ok: true, message: "Tipo de menú actualizado.", ts: Date.now() };
  } catch (e) {
    logger.error("update_menu_type_failed", { err: e });
    return { ok: false, message: "No se pudo actualizar el tipo de menú.", ts: Date.now() };
  }
}

/** Create a catalog order (catalog mode restaurants). */
export type CreateCatalogOrderInput = {
  restaurantSlug: string;
  name: string;
  phone: string;
  address: string;
  fulfillment: "delivery" | "pickup";
  items: { categoryName: string; itemName: string; unitPrice: number; quantity: number }[];
};

export async function createCatalogOrder(input: CreateCatalogOrderInput) {
  try {
    const fulfillment = input.fulfillment === "pickup" ? "pickup" : "delivery";
    const name = validateFullName(input.name);
    const phone = validatePhone(input.phone);
    const address = fulfillment === "pickup" ? "Recoge en el restaurante" : validateAddress(input.address);
    if (!input.items.length) throw new Error("Agrega al menos un producto.");
    if (input.items.some(i => i.quantity < 1)) throw new Error("La cantidad mínima por producto es 1.");

    const order = await prisma.$transaction(async (tx) => {
      const restaurant = await tx.restaurant.findFirst({
        where: { slug: input.restaurantSlug, active: true },
        include: {
          menus: {
            where: { date: dateKeyToUtcDate(localDateKey()) },
            include: { categories: { include: { items: true } } },
            take: 1,
          },
        },
      });
      if (!restaurant) throw new Error("Restaurante no encontrado.");
      const menu = restaurant.menus[0];
      if (!menu) throw new Error("El restaurante no tiene menú para hoy.");

      // Validate items against current menu
      const allItems = menu.categories.flatMap(c => c.items.map(i => ({ categoryName: c.name, itemName: i.name, price: Number(i.price) })));
      for (const inputItem of input.items) {
        const found = allItems.find(i => i.categoryName === inputItem.categoryName && i.itemName === inputItem.itemName);
        if (!found) throw new Error(`"${inputItem.itemName}" ya no está disponible. Actualiza tu selección.`);
        // Use server price (authoritative, ignore client-sent price)
        inputItem.unitPrice = found.price;
      }

      const customer = await tx.customer.upsert({
        where: { restaurantId_phone: { restaurantId: restaurant.id, phone } },
        update: { name, lastAddress: address },
        create: { restaurantId: restaurant.id, name, phone, lastAddress: address },
      });

      const orderDate = localDateKey();
      const counter = await tx.dailyOrderCounter.upsert({
        where: { restaurantId_date: { restaurantId: restaurant.id, date: orderDate } },
        update: { lastNumber: { increment: 1 } },
        create: { restaurantId: restaurant.id, date: orderDate, lastNumber: 1 },
      });

      const deliveryFee = new Prisma.Decimal(
        fulfillment === "delivery" && restaurant.deliveryMode === "fixed"
          ? Number(restaurant.deliveryFee ?? 0) : 0,
      );
      // Decimal arithmetic throughout — avoids float rounding on line totals.
      const lineTotal = (i: { unitPrice: number; quantity: number }) =>
        new Prisma.Decimal(i.unitPrice).times(i.quantity);
      const itemsTotal = input.items.reduce(
        (acc, i) => acc.plus(lineTotal(i)),
        new Prisma.Decimal(0),
      );
      const total = itemsTotal.plus(deliveryFee);

      return tx.order.create({
        data: {
          restaurantId: restaurant.id,
          customerId: customer.id,
          customerName: name,
          orderDate,
          orderNumber: counter.lastNumber,
          status: OrderStatus.PAYMENT_PENDING,
          total,
          deliveryFee,
          fulfillment,
          address,
          items: {
            create: input.items.map(i => ({
              soup: "", protein: "", side: "", drink: "",
              price: lineTotal(i),
              catalogCategory: i.categoryName,
              catalogItem: i.itemName,
              quantity: i.quantity,
              unitPrice: new Prisma.Decimal(i.unitPrice),
            })),
          },
        },
      });
    });

    revalidatePath(`/restaurant/${input.restaurantSlug}/orders`);
    revalidatePath("/admin");
    logger.info("order_created", { mode: "catalog", restaurantSlug: input.restaurantSlug, orderNumber: order.orderNumber });
    return { orderNumber: order.orderNumber, publicToken: order.publicToken };
  } catch (cause) {
    logger.warn("catalog_order_failed", { restaurantSlug: input.restaurantSlug, err: cause });
    throw cause;
  }
}
