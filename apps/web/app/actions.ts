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
  const name = validateFullName(input.name);
  const phone = validatePhone(input.phone);
  const address = validateAddress(input.address);
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

    // Total = sum of (basePrice + individual surcharges) for each lunch
    const total = input.items.reduce((sum, item) => {
      const extra =
        parseSurcharge(item.soup) +
        parseSurcharge(item.protein) +
        parseSurcharge(item.side) +
        parseSurcharge(item.drink);
      return sum + Number(restaurant.basePrice) + extra;
    }, 0);

    return tx.order.create({
      data: {
        restaurantId: restaurant.id,
        customerId: customer.id,
        customerName: name, // snapshot — name won't change even if customer upserts later
        orderDate,
        orderNumber: counter.lastNumber,
        status: OrderStatus.PAYMENT_PENDING,
        total: new Prisma.Decimal(total),
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
export async function setRestaurantPassword(formData: FormData) {
  const restaurantId = String(formData.get("restaurantId"));
  const password = String(formData.get("password") ?? "").trim();
  if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");

  const { hash } = await import("bcryptjs");
  const passwordHash = await hash(password, 12);
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { passwordHash } });
  revalidatePath("/admin");
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

export async function updateTodayMenu(formData: FormData) {
  const restaurantId = String(formData.get("restaurantId"));
  const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
  const menu = {
    soups: splitOptions(formData.get("soups")),
    proteins: splitOptions(formData.get("proteins")),
    sides: splitOptions(formData.get("sides")),
    drinks: splitOptions(formData.get("drinks")),
  };
  if (Object.values(menu).some((options) => !options.length)) {
    throw new Error("Cada categoría necesita al menos una opción.");
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
  // No redirect: returning without navigating keeps the user's scroll position.
  // revalidatePath above refreshes the data in place.
}

export async function updateBasePrice(formData: FormData) {
  const restaurantId = String(formData.get("restaurantId"));
  const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
  const basePrice = Number(formData.get("basePrice"));
  if (!Number.isFinite(basePrice) || basePrice <= 0) throw new Error("Precio inválido.");

  const restaurant = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { basePrice },
    select: { slug: true },
  });
  revalidatePath("/admin");
  revalidatePath(returnPath);
  revalidatePath(`/r/${restaurant.slug}`);
  // No redirect: returning without navigating keeps the user's scroll position.
  // revalidatePath above refreshes the data in place.
}

export async function updateBusinessPhone(formData: FormData) {
  const restaurantId = String(formData.get("restaurantId"));
  const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
  const whatsappPhone = String(formData.get("whatsappPhone") ?? "").replace(/\D/g, "").slice(0, 15) || null;

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { whatsappPhone },
  });
  revalidatePath("/admin");
  revalidatePath(returnPath);
  revalidatePath(`/r/${(await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { slug: true } }))?.slug ?? ""}`);
  // No redirect: returning without navigating keeps the user's scroll position.
  // revalidatePath above refreshes the data in place.
}

export async function updatePaymentSettings(formData: FormData) {
  const restaurantId = String(formData.get("restaurantId"));
  const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
  const nequiAccountName = required(String(formData.get("nequiAccountName") ?? ""), "titular");
  const nequiPhone = required(String(formData.get("nequiPhone") ?? ""), "celular o llave Nequi");
  const file = formData.get("nequiQr");
  const nequiQrPath = file instanceof File ? await saveUpload(file, "nequi-qr") : null;

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
  // No redirect: returning without navigating keeps the user's scroll position.
  // revalidatePath above refreshes the data in place.
}

export async function updateMenuTemplate(formData: FormData) {
  const restaurantId = String(formData.get("restaurantId"));
  const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
  const file = formData.get("menuTemplate");
  const menuTemplatePath = file instanceof File ? await saveUpload(file, "menu-template") : null;
  if (!menuTemplatePath) {
    throw new Error("Sube una imagen de plantilla (PNG, JPG o WEBP) de 1080×1350.");
  }

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { menuTemplatePath },
  });
  revalidatePath("/admin");
  revalidatePath(returnPath);
  // No redirect: returning without navigating keeps the user's scroll position.
  // revalidatePath above refreshes the data in place.
}

export async function createPaymentMethod(formData: FormData) {
  const restaurantId = String(formData.get("restaurantId"));
  const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
  const label = required(String(formData.get("label") ?? ""), "tipo de pago");
  const phone = required(String(formData.get("phone") ?? ""), "número o llave");
  const accountName = required(String(formData.get("accountName") ?? ""), "titular");

  const count = await prisma.paymentMethod.count({ where: { restaurantId } });
  await prisma.paymentMethod.create({
    data: { restaurantId, label, phone, accountName, position: count },
  });
  revalidatePath("/admin");
  revalidatePath(returnPath);
  // No redirect: returning without navigating keeps the user's scroll position.
  // revalidatePath above refreshes the data in place.
}

export async function deletePaymentMethod(formData: FormData) {
  const id = String(formData.get("id"));
  const restaurantId = String(formData.get("restaurantId"));
  const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");

  const method = await prisma.paymentMethod.findFirst({ where: { id, restaurantId } });
  if (!method) throw new Error("Método de pago no encontrado.");
  await prisma.paymentMethod.delete({ where: { id } });
  revalidatePath("/admin");
  revalidatePath(returnPath);
  // No redirect: returning without navigating keeps the user's scroll position.
  // revalidatePath above refreshes the data in place.
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
