import { notFound } from "next/navigation";
import { CustomerOrderForm } from "@/components/customer-order-form";
import { FindOrderForm } from "@/components/find-order-form";
import { formatMoney } from "@/lib/format";
import { resolveFileUrl } from "@/lib/file-url";
import { getRestaurantMenu } from "@/lib/data";

export default async function RestaurantMenuPage({ params }: { params: Promise<{ restaurantSlug: string }> }) {
  const { restaurantSlug } = await params;
  const restaurant = await getRestaurantMenu(restaurantSlug);
  if (!restaurant) notFound();

  const menu = restaurant.menus[0];
  const logoUrl = resolveFileUrl(restaurant.logoPath);
  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <header className="flex items-center gap-4 py-5">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={restaurant.name} className="h-20 w-20 shrink-0 rounded-2xl border border-stone-200 bg-white object-contain p-1 shadow-sm" src={logoUrl} />
        )}
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">Menú del día</p>
          <h1 className="mt-1 text-3xl font-bold">{restaurant.name}</h1>
          <p className="mt-2 text-stone-600">Arma tu almuerzo desde {formatMoney(Number(restaurant.basePrice))}.</p>
        </div>
      </header>
      {menu ? (
        <CustomerOrderForm
          restaurantSlug={restaurant.slug}
          basePrice={Number(restaurant.basePrice)}
          menu={menu}
        />
      ) : (
        <section className="card text-center">
          <p className="text-lg font-semibold text-stone-900">Estamos preparando el menú de hoy 🍲</p>
          <p className="mt-1 text-stone-600">Vuelve en un momento para armar tu pedido.</p>
          {(() => {
            const phone = (restaurant.whatsappPhone ?? restaurant.nequiPhone ?? "").replace(/\D/g, "");
            if (!phone) return null;
            const wa = phone.startsWith("57") ? phone : `57${phone}`;
            const text = encodeURIComponent(`Hola! ¿Ya tienen el menú de hoy en ${restaurant.name}?`);
            return (
              <a className="button-primary mt-4 inline-flex" href={`https://wa.me/${wa}?text=${text}`} rel="noreferrer" target="_blank">
                Preguntar por WhatsApp
              </a>
            );
          })()}
        </section>
      )}
      <FindOrderForm restaurantSlug={restaurant.slug} />
    </main>
  );
}
