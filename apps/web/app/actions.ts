"use server";

import { OrderStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dateKeyToUtcDate, localDateKey } from "@/lib/format";
import { parseItemName, parseSurcharge, SIN_SOPA } from "@/lib/menu";
import { prisma } from "@/lib/prisma";
import { saveUpload } from "@/lib/storage";

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

function validateFullName(value: string) {
  const clean = value.trim();
  if (!clean) throw new Error("Escribe tu nombre y apellido.");
  if (clean.length < 5) throw new Error("El nombre debe tener al menos 5 caracteres.");
  if (clean.split(" ").filter(Boolean).length < 2) throw new Error("Incluye nombre y apellido completos.");
  return clean;
}

function validatePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10) throw new Error("El teléfono debe tener 10 dígitos (ej. 3001234567).");
  if (!digits.startsWith("3")) throw new Error("Ingresa un celular colombiano válido (comienza con 3).");
  return digits;
}

function validateAddress(value: string) {
  const clean = value.trim();
  if (!clean) throw new Error("Escribe tu dirección de entrega.");
  if (clean.length < 10) throw new Error("La dirección debe ser más específica (mínimo 10 caracteres).");
  return clean;
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

export async function updateOrderStatus(formData: FormData) {
  const id = String(formData.get("id"));
  const slug = String(formData.get("slug"));
  const status = String(formData.get("status")) as OrderStatus;
  if (!Object.values(OrderStatus).includes(status)) throw new Error("Estado inválido.");

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) throw new Error("Restaurante no encontrado.");
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
    const name = required(String(formData.get("name") ?? ""), "nombre");
    const slug = required(String(formData.get("slug") ?? ""), "slug")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const basePrice = Number(formData.get("basePrice"));
    if (!Number.isFinite(basePrice) || basePrice <= 0) return { error: "El precio base debe ser mayor a 0.", success: false };

    const existing = await prisma.restaurant.findUnique({ where: { slug } });
    if (existing) return { error: `El slug "${slug}" ya está en uso. Elige otro.`, success: false };

    const rawPassword = String(formData.get("password") ?? "").trim();
    let passwordHash: string | undefined;
    if (rawPassword.length >= 8) {
      const { hash } = await import("bcryptjs");
      passwordHash = await hash(rawPassword, 12);
    }

    await prisma.restaurant.create({ data: { name, slug, basePrice, ...(passwordHash ? { passwordHash } : {}) } });
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
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("No autorizado.");

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
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("No autorizado.");

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
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("No autorizado.");

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

      const { parseSurcharge } = await import("@/lib/menu");
      const total = items.reduce((sum, item) => {
        return sum + Number(restaurant.basePrice) + parseSurcharge(item.protein) + parseSurcharge(item.soup);
      }, 0);

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
          status: status as never,
          total: new Prisma.Decimal(total),
          address: cust.address,
          createdAt: orderCreatedAt,
          ...(status !== "PAYMENT_PENDING" ? { paymentSubmittedAt: orderCreatedAt } : {}),
          items: {
            create: items.map((item) => ({
              ...item,
              price: new Prisma.Decimal(Number(restaurant.basePrice) + parseSurcharge(item.protein)),
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
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("No autorizado.");

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
    [{ cat: "Tortas Clásicas", item: "Torta Castilla - Tortica", price: 26000, qty: 1 }],
    [{ cat: "Tortas Clásicas", item: "Torta Red Velvet - 1/4 libra", price: 50000, qty: 1 }],
    [{ cat: "Tortas Clásicas", item: "Torta Zanahoria - 1/4 libra", price: 50000, qty: 1 }],
    [{ cat: "Cinnamon Rolls", item: "Caja x 4", price: 26000, qty: 1 }],
    [{ cat: "Cinnamon Rolls", item: "Caja x 6", price: 32000, qty: 1 }],
    [{ cat: "Tortas Clásicas", item: "Torta Castilla - 1/2 libra", price: 78000, qty: 1 }],
    [{ cat: "Tortas Clásicas", item: "Torta Mora & Arequipe - Tortica", price: 26000, qty: 1 }, { cat: "Cinnamon Rolls", item: "Caja x 4", price: 26000, qty: 1 }],
    [{ cat: "Tortas Clásicas", item: "Torta Limón - Tortica", price: 26000, qty: 2 }],
    [{ cat: "Red Velvet Especial Fresas", item: "Redonda 1/4 libra", price: 62000, qty: 1 }],
    [{ cat: "Tortas Clásicas", item: "Torta Valencia - Tortica", price: 26000, qty: 1 }],
    [{ cat: "Caja de Galletas", item: "Caja mediana", price: 49000, qty: 1 }],
    [{ cat: "Tortas en Corazón", item: "Corazón 1/4 libra (8-10 porciones)", price: 59000, qty: 1 }],
    [{ cat: "Tortas Clásicas", item: "Torta Arequipe - 1/4 libra", price: 50000, qty: 1 }],
    [{ cat: "Cinnamon Rolls", item: "Caja x 6", price: 32000, qty: 2 }],
    [{ cat: "Tortas Clásicas", item: "Torta Castilla - 1 libra", price: 119000, qty: 1 }],
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
        { name: "Tortas Clásicas", items: [
          { name: "Torta Castilla - Tortica", price: 26000 }, { name: "Torta Castilla - 1/4 libra", price: 54000 }, { name: "Torta Castilla - 1/2 libra", price: 78000 }, { name: "Torta Castilla - 1 libra", price: 119000 },
          { name: "Torta Mora & Arequipe - Tortica", price: 26000 }, { name: "Torta Red Velvet - 1/4 libra", price: 50000 }, { name: "Torta Zanahoria - 1/4 libra", price: 50000 }, { name: "Torta Limón - Tortica", price: 26000 },
          { name: "Torta Valencia - Tortica", price: 26000 }, { name: "Torta Arequipe - 1/4 libra", price: 50000 },
        ]},
        { name: "Tortas en Corazón", items: [{ name: "Corazón 1/4 libra (8-10 porciones)", price: 59000 }, { name: "Corazón 1/2 libra (18-22 porciones)", price: 81000 }] },
        { name: "Red Velvet Especial Fresas", items: [{ name: "Redonda 1/4 libra", price: 62000 }, { name: "Redonda 1/2 libra", price: 85000 }] },
        { name: "Cinnamon Rolls", items: [{ name: "Caja x 4", price: 26000 }, { name: "Caja x 6", price: 32000 }] },
        { name: "Caja de Galletas", items: [{ name: "Caja pequeña", price: 36000 }, { name: "Caja mediana", price: 49000 }, { name: "Caja grande", price: 59000 }] },
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
      let status: string;
      if (isToday) {
        status = j < 2 ? "PAYMENT_PENDING" : "PAYMENT_CONFIRMED";
      } else {
        status = Math.random() < 0.88 ? "PAYMENT_CONFIRMED" : "CANCELLED";
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
          status: status as never,
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

/** Admin: activate or renew a restaurant's subscription. */
export async function setRestaurantSubscription(formData: FormData) {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("No autorizado.");

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
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("No autorizado.");

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
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("No autorizado.");

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
export async function deleteRestaurant(formData: FormData) {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("No autorizado.");

  const restaurantId = String(formData.get("restaurantId"));
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();

  if (confirmation !== slug) throw new Error("La confirmación no coincide con el slug.");

  await prisma.restaurant.delete({ where: { id: restaurantId } });
  revalidatePath("/admin");
}

/** Admin: immediately deactivate a restaurant's subscription (no grace period). */
export async function deactivateRestaurantSubscription(formData: FormData) {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("No autorizado.");

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

export type ActionState = { ok: boolean; message: string; ts: number };
export type MenuFormState = ActionState;

export async function updateTodayMenu(_prev: MenuFormState, formData: FormData): Promise<MenuFormState> {
  const restaurantId = String(formData.get("restaurantId"));
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
    console.error("[updateLogo]", e);
    return { ok: false, message: "No se pudo guardar el logo. Intenta de nuevo.", ts: Date.now() };
  }
}

export async function updateDeliverySettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const restaurantId = String(formData.get("restaurantId"));
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
    console.error("[updateMenuTemplate]", e);
    return { ok: false, message: "No se pudo guardar la plantilla. Intenta de nuevo.", ts: Date.now() };
  }
}

/** Clear the upload history so the 4 default presets are shown again. */
export async function resetMenuTemplates(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const restaurantId = String(formData.get("restaurantId"));
  const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { menuTemplateHistory: [] } });
  revalidatePath("/admin");
  revalidatePath(returnPath);
  return { ok: true, message: "Plantillas predeterminadas restauradas.", ts: Date.now() };
}

/** Select an existing template (a preset or one from the upload history). */
export async function selectMenuTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const restaurantId = String(formData.get("restaurantId"));
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
  try {
    const restaurantSlug = String(formData.get("restaurantSlug"));
    const publicToken = String(formData.get("publicToken"));
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
    return { error: "", success: true };
  } catch (cause) {
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
  id?: string;       // present for existing categories, absent for new ones
  name: string;
  items: { id?: string; name: string; price: number }[];
};

export type CatalogMenuState = { ok: boolean; message: string; ts: number };

/** Upsert today's catalog menu (dynamic categories + items with per-item prices). */
export async function updateCatalogMenu(
  _prev: CatalogMenuState,
  formData: FormData,
): Promise<CatalogMenuState> {
  try {
    const restaurantId = String(formData.get("restaurantId"));
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
      if (!cat.items.length) return { ok: false, message: `La categoría "${cat.name}" no tiene productos.`, ts: Date.now() };
      for (const item of cat.items) {
        if (!item.name.trim()) return { ok: false, message: `Un producto en "${cat.name}" no tiene nombre.`, ts: Date.now() };
        if (item.price < 0) return { ok: false, message: `Precio inválido en "${cat.name}".`, ts: Date.now() };
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

    // Replace all categories: delete existing, recreate from submitted data.
    await prisma.menuCategory.deleteMany({ where: { menuId: menu.id } });
    for (let ci = 0; ci < categories.length; ci++) {
      const cat = categories[ci];
      const created = await prisma.menuCategory.create({
        data: { menuId: menu.id, name: cat.name.trim(), position: ci },
      });
      for (let ii = 0; ii < cat.items.length; ii++) {
        const item = cat.items[ii];
        await prisma.menuItem.create({
          data: {
            categoryId: created.id,
            name: item.name.trim(),
            price: new Prisma.Decimal(item.price),
            position: ii,
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
    console.error("[updateCatalogMenu]", e);
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
    const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
    await prisma.menu.deleteMany({ where: { restaurantId, date: dateKeyToUtcDate(localDateKey()) } });
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { slug: true } });
    revalidatePath("/admin");
    revalidatePath(returnPath);
    if (restaurant) revalidatePath(`/r/${restaurant.slug}`);
    return { ok: true, message: "Menú despublicado. Tus clientes ya no lo ven.", ts: Date.now() };
  } catch (e) {
    console.error("[unpublishCatalogMenu]", e);
    return { ok: false, message: "No se pudo despublicar el menú.", ts: Date.now() };
  }
}

/** Switch a restaurant's menu type between "combo" and "catalog". */
export async function updateMenuType(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const restaurantId = String(formData.get("restaurantId"));
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
    console.error("[updateMenuType]", e);
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

      const deliveryFee =
        fulfillment === "delivery" && restaurant.deliveryMode === "fixed"
          ? Number(restaurant.deliveryFee ?? 0) : 0;
      const itemsTotal = input.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      const total = itemsTotal + deliveryFee;

      return tx.order.create({
        data: {
          restaurantId: restaurant.id,
          customerId: customer.id,
          customerName: name,
          orderDate,
          orderNumber: counter.lastNumber,
          status: OrderStatus.PAYMENT_PENDING,
          total: new Prisma.Decimal(total),
          deliveryFee: new Prisma.Decimal(deliveryFee),
          fulfillment,
          address,
          items: {
            create: input.items.map(i => ({
              soup: "", protein: "", side: "", drink: "",
              price: new Prisma.Decimal(i.unitPrice * i.quantity),
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
    return { orderNumber: order.orderNumber, publicToken: order.publicToken };
  } catch (cause) {
    throw cause;
  }
}
