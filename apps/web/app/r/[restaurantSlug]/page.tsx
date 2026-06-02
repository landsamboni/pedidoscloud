import { notFound } from "next/navigation";
import { CustomerOrderForm } from "@/components/customer-order-form";
import { FindOrderForm } from "@/components/find-order-form";
import { formatMoney } from "@/lib/format";
import { getRestaurantMenu } from "@/lib/data";

export default async function RestaurantMenuPage({ params }: { params: Promise<{ restaurantSlug: string }> }) {
  const { restaurantSlug } = await params;
  const restaurant = await getRestaurantMenu(restaurantSlug);
  if (!restaurant) notFound();

  const menu = restaurant.menus[0];
  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <header className="py-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-violet-700">Menú del día</p>
        <h1 className="mt-1 text-3xl font-bold">{restaurant.name}</h1>
        <p className="mt-2 text-stone-600">Arma tu almuerzo desde {formatMoney(Number(restaurant.basePrice))}.</p>
      </header>
      <FindOrderForm restaurantSlug={restaurant.slug} />
      {menu ? (
        <CustomerOrderForm
          restaurantSlug={restaurant.slug}
          basePrice={Number(restaurant.basePrice)}
          menu={menu}
        />
      ) : (
        <section className="card">Todavía no hay menú disponible para hoy.</section>
      )}
    </main>
  );
}
