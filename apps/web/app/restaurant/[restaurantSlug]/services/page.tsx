import { notFound } from "next/navigation";
import { ServicesEditor } from "@/components/services-editor";
import { getRestaurantServices } from "@/lib/data";

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  const data = await getRestaurantServices(restaurantSlug);
  if (!data) notFound();

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">Catálogo de servicios</p>
        <h1 className="mt-1 text-3xl font-bold">{data.restaurant.name}</h1>
        <p className="mt-1 text-sm text-stone-500">
          Define los servicios que ofreces, su duración, precio y el horario de atención.
        </p>
      </header>

      <ServicesEditor
        restaurantId={data.restaurant.id}
        services={data.services.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          durationMins: s.durationMins,
          price: s.price.toString(),
          active: s.active,
          position: s.position,
        }))}
        businessHours={data.businessHours.map((h) => ({
          dayOfWeek: h.dayOfWeek,
          openTime: h.openTime,
          closeTime: h.closeTime,
          closed: h.closed,
        }))}
      />
    </main>
  );
}
