import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const comboMenu = {
  soups: ["Sancocho", "Sopa de arroz", "Sopa de lentejas"],
  proteins: ["Pollo asado", "Pollo apanado", "Res a la plancha"],
  sides: ["Frijoles", "Lentejas", "Papa a la francesa"],
  drinks: ["Jugo de lulo", "Limonada"],
};

function todayUtc() {
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${key}T00:00:00.000Z`);
}

// ── Mi Pastelería catalog ────────────────────────────────────────────────────
const PASTELERIA_CATEGORIES = [
  {
    name: "Tortas Clásicas",
    items: [
      { name: "Torta Castilla - Tortica", price: 26000 },
      { name: "Torta Castilla - 1/4 libra", price: 54000 },
      { name: "Torta Castilla - 1/2 libra", price: 78000 },
      { name: "Torta Castilla - 1 libra", price: 119000 },
      { name: "Torta Mora & Arequipe - Tortica", price: 26000 },
      { name: "Torta Mora & Arequipe - 1/4 libra", price: 54000 },
      { name: "Torta Mora & Arequipe - 1/2 libra", price: 78000 },
      { name: "Torta Mora & Arequipe - 1 libra", price: 119000 },
      { name: "Torta Red Velvet - Tortica", price: 26000 },
      { name: "Torta Red Velvet - 1/4 libra", price: 50000 },
      { name: "Torta Red Velvet - 1/2 libra", price: 75000 },
      { name: "Torta Red Velvet - 1 libra", price: 114000 },
      { name: "Torta Limón - Tortica", price: 26000 },
      { name: "Torta Limón - 1/4 libra", price: 54000 },
      { name: "Torta Limón - 1/2 libra", price: 78000 },
      { name: "Torta Limón - 1 libra", price: 119000 },
      { name: "Torta Zanahoria - Tortica", price: 26000 },
      { name: "Torta Zanahoria - 1/4 libra", price: 50000 },
      { name: "Torta Zanahoria - 1/2 libra", price: 75000 },
      { name: "Torta Zanahoria - 1 libra", price: 114000 },
      { name: "Torta Valencia - Tortica", price: 26000 },
      { name: "Torta Valencia - 1/4 libra", price: 50000 },
      { name: "Torta Valencia - 1/2 libra", price: 75000 },
      { name: "Torta Valencia - 1 libra", price: 114000 },
      { name: "Torta Arequipe - Tortica", price: 26000 },
      { name: "Torta Arequipe - 1/4 libra", price: 50000 },
      { name: "Torta Arequipe - 1/2 libra", price: 75000 },
      { name: "Torta Arequipe - 1 libra", price: 114000 },
    ],
  },
  {
    name: "Tortas en Corazón",
    items: [
      { name: "Corazón Mini (1-2 porciones)", price: 18000 },
      { name: "Corazón 1/4 libra (8-10 porciones)", price: 59000 },
      { name: "Corazón 1/2 libra (18-22 porciones)", price: 81000 },
    ],
  },
  {
    name: "Red Velvet Especial Fresas",
    items: [
      { name: "Redonda 1/4 libra", price: 62000 },
      { name: "Redonda 1/2 libra", price: 85000 },
      { name: "Redonda 1 libra", price: 129000 },
      { name: "Corazón 1/4 libra", price: 73000 },
      { name: "Corazón 1/2 libra", price: 93000 },
    ],
  },
  {
    name: "Cinnamon Rolls",
    items: [
      { name: "Caja x 4", price: 26000 },
      { name: "Caja x 6", price: 32000 },
    ],
  },
  {
    name: "Caja de Galletas",
    items: [
      { name: "Caja pequeña", price: 36000 },
      { name: "Caja mediana", price: 49000 },
      { name: "Caja grande", price: 59000 },
    ],
  },
];

async function main() {
  // ── Combo restaurants ───────────────────────────────────────────────────
  const comboRestaurants = [
    {
      name: "Martica la Bonita",
      slug: "martica-la-bonita",
      basePrice: 14000,
      nequiAccountName: "Martica la Bonita",
      nequiPhone: "3186673967",
      whatsappPhone: "3186673967",
    },
    {
      name: "Sazón de Casa",
      slug: "sazon-de-casa",
      basePrice: 16000,
      nequiAccountName: "Sazón de Casa",
      nequiPhone: "3186673967",
      whatsappPhone: "3186673967",
    },
  ];

  for (const r of comboRestaurants) {
    const saved = await prisma.restaurant.upsert({
      where: { slug: r.slug },
      update: r,
      create: r,
    });
    await prisma.menu.upsert({
      where: { restaurantId_date: { restaurantId: saved.id, date: todayUtc() } },
      update: comboMenu,
      create: { restaurantId: saved.id, date: todayUtc(), ...comboMenu },
    });
  }

  // ── Mi Pastelería (catalog mode) ────────────────────────────────────────
  const pasteleria = await prisma.restaurant.upsert({
    where: { slug: "mi-pasteleria" },
    update: {
      name: "Mi Pastelería",
      menuType: "catalog",
      orderUnitLabel: "pedido",
      basePrice: 0,
      nequiAccountName: "Mi Pastelería",
      nequiPhone: "3014961187",
      whatsappPhone: "3014961187",
      deliveryMode: "separate",
      allowPickup: true,
    },
    create: {
      name: "Mi Pastelería",
      slug: "mi-pasteleria",
      menuType: "catalog",
      orderUnitLabel: "pedido",
      basePrice: 0,
      nequiAccountName: "Mi Pastelería",
      nequiPhone: "3014961187",
      whatsappPhone: "3014961187",
      deliveryMode: "separate",
      allowPickup: true,
    },
  });

  // Create today's menu with catalog categories (idempotent)
  const existing = await prisma.menu.findUnique({
    where: { restaurantId_date: { restaurantId: pasteleria.id, date: todayUtc() } },
    include: { categories: true },
  });

  let menuRecord = existing;
  if (!existing) {
    menuRecord = await prisma.menu.create({
      data: {
        restaurantId: pasteleria.id,
        date: todayUtc(),
        soups: [],
        proteins: [],
        sides: [],
        drinks: [],
      },
      include: { categories: true },
    });
  }

  // Recreate categories only when empty (avoids duplicates on re-seed)
  if (menuRecord && (menuRecord as any).categories.length === 0) {
    for (let ci = 0; ci < PASTELERIA_CATEGORIES.length; ci++) {
      const cat = PASTELERIA_CATEGORIES[ci];
      const createdCat = await prisma.menuCategory.create({
        data: { menuId: menuRecord.id, name: cat.name, position: ci },
      });
      for (let ii = 0; ii < cat.items.length; ii++) {
        await prisma.menuItem.create({
          data: {
            categoryId: createdCat.id,
            name: cat.items[ii].name,
            price: cat.items[ii].price,
            position: ii,
          },
        });
      }
    }
    console.log("✓ Mi Pastelería catalog menu created with", PASTELERIA_CATEGORIES.reduce((s, c) => s + c.items.length, 0), "items");
  }

  console.log("🌱 Seed complete");
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
