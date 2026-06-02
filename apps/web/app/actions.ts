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

export async function createRestaurant(formData: FormData) {
  const name = required(String(formData.get("name") ?? ""), "nombre");
  const slug = required(String(formData.get("slug") ?? ""), "slug")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
  const basePrice = Number(formData.get("basePrice"));
  if (!Number.isFinite(basePrice) || basePrice <= 0) throw new Error("Precio inválido.");

  const rawPassword = String(formData.get("password") ?? "").trim();
  let passwordHash: string | undefined;
  if (rawPassword.length >= 8) {
    const { hash } = await import("bcryptjs");
    passwordHash = await hash(rawPassword, 12);
  }

  await prisma.restaurant.create({ data: { name, slug, basePrice, ...(passwordHash ? { passwordHash } : {}) } });
  revalidatePath("/admin");
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
  redirect(returnPath);
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
  redirect(returnPath);
}

export async function updatePaymentSettings(formData: FormData) {
  const restaurantId = String(formData.get("restaurantId"));
  const returnPath = safeReturnPath(formData.get("returnPath"), "/admin");
  const nequiAccountName = required(String(formData.get("nequiAccountName") ?? ""), "titular");
  const nequiPhone = required(String(formData.get("nequiPhone") ?? ""), "celular o llave Nequi");
  const whatsappPhone = String(formData.get("whatsappPhone") ?? "").replace(/\D/g, "").slice(0, 15) || null;
  const file = formData.get("nequiQr");
  const nequiQrPath = file instanceof File ? await saveUpload(file, "nequi-qr") : null;

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      nequiAccountName,
      nequiPhone,
      whatsappPhone,
      ...(nequiQrPath ? { nequiQrPath } : {}),
    },
  });
  revalidatePath("/admin");
  revalidatePath(returnPath);
  redirect(returnPath);
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
  redirect(returnPath);
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
  redirect(returnPath);
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
