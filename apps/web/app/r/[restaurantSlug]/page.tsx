import { notFound } from "next/navigation";
import { CustomerOrderForm } from "@/components/customer-order-form";
import { CatalogOrderForm } from "@/components/catalog-order-form";
import { AppointmentForm } from "@/components/appointment-form";
import { FindOrderForm } from "@/components/find-order-form";
import { formatMoney } from "@/lib/format";
import { resolveFileUrl } from "@/lib/file-url";
import { DEFAULT_LOGO_PATH } from "@/lib/branding";
import { getRestaurantMenu, getRestaurantForBooking, getBookedSlots } from "@/lib/data";
import { localDateKey } from "@/lib/format";

export default async function RestaurantMenuPage({ params }: { params: Promise<{ restaurantSlug: string }> }) {
  const { restaurantSlug } = await params;

  // Barbershop flow — appointment booking instead of ordering
  const baseRestaurant = await getRestaurantForBooking(restaurantSlug);
  if (!baseRestaurant) notFound();

  const isBarbershop = baseRestaurant.businessType === "barbershop";
  const logoUrl = resolveFileUrl(baseRestaurant.logoPath) ?? DEFAULT_LOGO_PATH;

  if (isBarbershop) {
    const bookedRaw = await getBookedSlots(baseRestaurant.id, localDateKey());
    const bookedSlots = bookedRaw.map((s) => ({
      scheduledAt: s.scheduledAt,
      durationMins: s.durationMins,
    }));

    return (
      <main className="mx-auto max-w-2xl p-4 sm:p-6">
        <header className="flex items-center gap-4 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={baseRestaurant.name} className="h-20 w-20 shrink-0 rounded-2xl border border-stone-200 bg-white object-contain p-1 shadow-sm" src={logoUrl} />
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-blue">Agenda tu cita</p>
            <h1 className="mt-1 text-3xl font-bold">{baseRestaurant.name}</h1>
            <p className="mt-2 text-stone-600">Selecciona el servicio, fecha y hora disponible.</p>
          </div>
        </header>

        <AppointmentForm
          restaurantSlug={restaurantSlug}
          services={baseRestaurant.services.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            durationMins: s.durationMins,
            price: Number(s.price),
          }))}
          businessHours={baseRestaurant.businessHours}
          bookedSlots={bookedSlots}
        />
      </main>
    );
  }

  // Orders flow (all other business types)
  const restaurant = await getRestaurantMenu(restaurantSlug);
  if (!restaurant) notFound();

  const menu = restaurant.menus[0];
  const orderLogoUrl = resolveFileUrl(restaurant.logoPath) ?? DEFAULT_LOGO_PATH;
  const isCatalog = restaurant.menuType === "catalog";
  const deliveryProps = {
    mode: restaurant.deliveryMode,
    fee: restaurant.deliveryFee ? Number(restaurant.deliveryFee) : 0,
    note: restaurant.deliveryNote,
    allowPickup: restaurant.allowPickup,
  };

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <header className="flex items-center gap-4 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={restaurant.name} className="h-20 w-20 shrink-0 rounded-2xl border border-stone-200 bg-white object-contain p-1 shadow-sm" src={orderLogoUrl} />
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-blue">{isCatalog ? "Nuestros productos" : "Menú del día"}</p>
          <h1 className="mt-1 text-3xl font-bold">{restaurant.name}</h1>
          {!isCatalog && (
            <p className="mt-2 text-stone-600">Arma tu {restaurant.orderUnitLabel} desde {formatMoney(Number(restaurant.basePrice))}.</p>
          )}
        </div>
      </header>

      {menu ? (
        isCatalog ? (
          <CatalogOrderForm
            restaurantSlug={restaurant.slug}
            orderUnitLabel={restaurant.orderUnitLabel}
            categories={menu.categories.map(c => ({
              id: c.id,
              name: c.name,
              items: c.items.map(i => ({ id: i.id, name: i.name, price: Number(i.price), description: i.description, imagePath: i.imagePath })),
            }))}
            delivery={deliveryProps}
          />
        ) : (
          <CustomerOrderForm
            restaurantSlug={restaurant.slug}
            basePrice={Number(restaurant.basePrice)}
            menu={{ soups: menu.soups, proteins: menu.proteins, sides: menu.sides, drinks: menu.drinks }}
            delivery={deliveryProps}
          />
        )
      ) : (
        <section className="card text-center">
          <p className="text-lg font-semibold text-stone-900">Estamos preparando el menú de hoy 🍲</p>
          <p className="mt-1 text-stone-600">Vuelve en un momento para ver nuestros productos.</p>
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
