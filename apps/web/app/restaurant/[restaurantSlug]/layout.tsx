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
    select: { id: true, name: true, slug: true },
  });
  if (!restaurant) notFound();

  // Count today's orders that need attention (drives the bell badge).
  const pendingCount = await prisma.order.count({
    where: {
      restaurantId: restaurant.id,
      orderDate: localDateKey(),
      status: { in: ["PAYMENT_REVIEW", "PAYMENT_PENDING", "NEW"] },
    },
  });

  return (
    <RestaurantShell
      pendingCount={pendingCount}
      restaurantName={restaurant.name}
      restaurantSlug={restaurantSlug}
    >
      {children}
    </RestaurantShell>
  );
}
