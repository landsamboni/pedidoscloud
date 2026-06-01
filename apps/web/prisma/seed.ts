import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const menu = {
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

async function main() {
  const restaurants = [
    {
      name: "Martica la Bonita",
      slug: "martica-la-bonita",
      basePrice: 14000,
      nequiAccountName: "Martica la Bonita",
      nequiPhone: "3001234567",
    },
    {
      name: "Sazón de Casa",
      slug: "sazon-de-casa",
      basePrice: 16000,
      nequiAccountName: "Sazón de Casa",
      nequiPhone: "3007654321",
    },
  ];

  for (const restaurant of restaurants) {
    const saved = await prisma.restaurant.upsert({
      where: { slug: restaurant.slug },
      update: restaurant,
      create: restaurant,
    });

    await prisma.menu.upsert({
      where: {
        restaurantId_date: {
          restaurantId: saved.id,
          date: todayUtc(),
        },
      },
      update: menu,
      create: {
        restaurantId: saved.id,
        date: todayUtc(),
        ...menu,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
