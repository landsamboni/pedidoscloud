import Link from "next/link";
import { notFound } from "next/navigation";
import { AppointmentAgenda } from "@/components/appointment-agenda";
import { getDayAppointments } from "@/lib/data";
import { localDateKey, APP_TIME_ZONE } from "@/lib/format";

function formatDateLabel(dateKey: string) {
  const [y, m, d] = dateKey.split("-");
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${y}-${m}-${d}T12:00:00.000Z`));
}

export default async function AppointmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ restaurantSlug: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { restaurantSlug } = await params;
  const { date } = await searchParams;
  const today = localDateKey();
  const dateKey = date ?? today;

  const data = await getDayAppointments(restaurantSlug, dateKey);
  if (!data) notFound();

  const dateLabel = formatDateLabel(dateKey);
  const isToday = dateKey === today;

  const prevDate = (() => {
    const d = new Date(`${dateKey}T12:00:00.000Z`);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  const nextDate = (() => {
    const d = new Date(`${dateKey}T12:00:00.000Z`);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  const appointments = data.appointments.map((a) => ({
    id: a.id,
    serviceName: a.serviceName,
    durationMins: a.durationMins,
    price: a.price.toString(),
    clientName: a.clientName,
    clientPhone: a.clientPhone,
    scheduledAt: a.scheduledAt,
    status: a.status as "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED",
    notes: a.notes,
  }));

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">Agenda del día</p>
        <h1 className="mt-1 text-3xl font-bold">{data.restaurant.name}</h1>

        {/* Date navigation */}
        <div className="mt-4 flex items-center gap-3">
          <Link
            className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium hover:bg-stone-50 transition"
            href={`/restaurant/${restaurantSlug}/appointments?date=${prevDate}`}
          >
            ← Anterior
          </Link>

          <p className="flex-1 text-center text-sm font-semibold capitalize">{dateLabel}</p>

          <Link
            className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium hover:bg-stone-50 transition"
            href={`/restaurant/${restaurantSlug}/appointments?date=${nextDate}`}
          >
            Siguiente →
          </Link>
        </div>

        {!isToday && (
          <div className="mt-2 text-center">
            <Link
              className="text-xs text-brand-blue hover:underline"
              href={`/restaurant/${restaurantSlug}/appointments`}
            >
              Volver a hoy
            </Link>
          </div>
        )}

        <p className="mt-3 text-sm text-stone-500">
          {appointments.length === 0
            ? "Sin citas para este día"
            : `${appointments.length} cita${appointments.length !== 1 ? "s" : ""}`}
        </p>
      </header>

      <AppointmentAgenda
        appointments={appointments}
        restaurantName={data.restaurant.name}
        dateLabel={dateLabel}
      />
    </main>
  );
}
