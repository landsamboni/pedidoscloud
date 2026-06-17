import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { localDateKey } from "@/lib/format";
import { RestaurantShell } from "@/components/restaurant-shell";

export default async function RestaurantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: restaurantSlug },
    select: { id: true, name: true, slug: true, businessType: true },
  });
  if (!restaurant) notFound();

  const isBarbershop = restaurant.businessType === "barbershop";

  // Pending count drives the bell badge — source differs by business flow.
  const pendingCount = isBarbershop
    ? await (async () => {
        const today = localDateKey();
        // UTC window for Bogotá day (UTC-5)
        const dayStart = new Date(`${today}T05:00:00.000Z`);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        return prisma.appointment.count({
          where: {
            restaurantId: restaurant.id,
            scheduledAt: { gte: dayStart, lt: dayEnd },
            status: "PENDING",
          },
        });
      })()
    : await prisma.order.count({
        where: {
          restaurantId: restaurant.id,
          orderDate: localDateKey(),
          status: { in: ["PAYMENT_REVIEW", "PAYMENT_PENDING", "NEW"] },
        },
      });

  return (
    <RestaurantShell
      businessType={restaurant.businessType}
      pendingCount={pendingCount}
      restaurantName={restaurant.name}
      restaurantSlug={restaurantSlug}
    >
      {children}
    </RestaurantShell>
  );
}
