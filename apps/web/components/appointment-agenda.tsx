"use client";

import { useTransition } from "react";
import { updateAppointmentStatus } from "@/app/actions";
import { formatMoney } from "@/lib/format";
import { APP_TIME_ZONE } from "@/lib/format";

type AppointmentStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";

type Appointment = {
  id: string;
  serviceName: string;
  durationMins: number;
  price: string;
  clientName: string;
  clientPhone: string;
  scheduledAt: Date;
  status: AppointmentStatus;
  notes: string | null;
};

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  PENDING:   "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-stone-100 text-stone-500 line-through",
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDING:   "Pendiente",
  CONFIRMED: "Confirmada",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("es-CO", { timeZone: APP_TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(date);
}

function AppointmentCard({ appt }: { appt: Appointment }) {
  const [isPending, startTransition] = useTransition();

  function changeStatus(status: AppointmentStatus) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("appointmentId", appt.id);
      fd.set("status", status);
      await updateAppointmentStatus(undefined as never, fd);
    });
  }

  const endTime = new Date(appt.scheduledAt.getTime() + appt.durationMins * 60 * 1000);

  return (
    <div className={`card space-y-3 ${appt.status === "CANCELLED" ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-stone-900">{appt.serviceName}</p>
          <p className="text-sm text-stone-500">
            {formatTime(appt.scheduledAt)} – {formatTime(endTime)} · {appt.durationMins} min
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[appt.status]}`}>
          {STATUS_LABELS[appt.status]}
        </span>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div>
          <p className="text-stone-500">Cliente</p>
          <p className="font-medium">{appt.clientName}</p>
        </div>
        <div>
          <p className="text-stone-500">Teléfono</p>
          <a
            className="font-medium text-brand-blue hover:underline"
            href={`tel:${appt.clientPhone}`}
          >
            {appt.clientPhone}
          </a>
        </div>
        <div>
          <p className="text-stone-500">Valor</p>
          <p className="font-semibold">{formatMoney(Number(appt.price))}</p>
        </div>
      </div>

      {appt.notes && (
        <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600">{appt.notes}</p>
      )}

      {appt.status !== "CANCELLED" && appt.status !== "COMPLETED" && (
        <div className="flex gap-2 flex-wrap">
          {appt.status === "PENDING" && (
            <button
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
              disabled={isPending}
              onClick={() => changeStatus("CONFIRMED")}
            >
              Confirmar
            </button>
          )}
          {(appt.status === "PENDING" || appt.status === "CONFIRMED") && (
            <button
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition"
              disabled={isPending}
              onClick={() => changeStatus("COMPLETED")}
            >
              Completada
            </button>
          )}
          <button
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
            disabled={isPending}
            onClick={() => changeStatus("CANCELLED")}
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

interface Props {
  appointments: Appointment[];
  restaurantName: string;
  dateLabel: string;
}

export function AppointmentAgenda({ appointments, restaurantName, dateLabel }: Props) {
  if (appointments.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-4xl mb-3">📅</p>
        <p className="text-lg font-semibold text-stone-900">Sin citas para este día</p>
        <p className="text-stone-500 mt-1">Cuando los clientes agenden, aparecerán aquí.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {appointments.map((appt) => (
        <AppointmentCard key={appt.id} appt={appt} />
      ))}
    </div>
  );
}
