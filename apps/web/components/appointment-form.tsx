"use client";

import { useState, useTransition } from "react";
import { bookAppointment } from "@/app/actions";
import { formatMoney } from "@/lib/format";
import { APP_TIME_ZONE } from "@/lib/format";

// ── Types ─────────────────────────────────────────────────────────────────────

type Service = {
  id: string;
  name: string;
  description: string | null;
  durationMins: number;
  price: number;
};

type BusinessHour = {
  dayOfWeek: number;
  openTime: string;  // "08:00"
  closeTime: string; // "18:00"
  closed: boolean;
};

type BookedSlot = {
  scheduledAt: Date;
  durationMins: number;
};

interface Props {
  restaurantSlug: string;
  services: Service[];
  businessHours: BusinessHour[];
  bookedSlots: BookedSlot[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** Return "HH:MM" for a Date in Bogotá timezone */
function toHHMM(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

/** Return YYYY-MM-DD for a Date in Bogotá timezone */
function toDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Build next 14 available dates (days that are not closed per businessHours). */
function getAvailableDates(businessHours: BusinessHour[]): { dateKey: string; label: string; dayOfWeek: number }[] {
  const closedDays = new Set(businessHours.filter((h) => h.closed).map((h) => h.dayOfWeek));
  const openDays = new Set(businessHours.filter((h) => !h.closed).map((h) => h.dayOfWeek));
  // If no businessHours defined at all, default open Mon-Sat (1-6)
  const isOpen = (dow: number) => openDays.size > 0 ? openDays.has(dow) : (dow >= 1 && dow <= 6);

  const dates: { dateKey: string; label: string; dayOfWeek: number }[] = [];
  const now = new Date();
  const cursor = new Date(now);

  // Start from tomorrow — same-day bookings not supported for simplicity
  cursor.setDate(cursor.getDate() + 1);

  while (dates.length < 14) {
    const dow = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: APP_TIME_ZONE, weekday: "short" }).format(cursor).slice(0, 3) === "Sun" ? "0" : String((cursor.getDay())));
    const localDow = (() => {
      // Compute day of week in Bogotá timezone
      const s = new Intl.DateTimeFormat("en-US", { timeZone: APP_TIME_ZONE, weekday: "short" }).format(cursor);
      const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      return map[s.slice(0, 3)] ?? cursor.getDay();
    })();
    if (isOpen(localDow) && !closedDays.has(localDow)) {
      const dateKey = toDateKey(cursor);
      const label = new Intl.DateTimeFormat("es-CO", { timeZone: APP_TIME_ZONE, weekday: "long", month: "long", day: "numeric" }).format(cursor);
      dates.push({ dateKey, label, dayOfWeek: localDow });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

/** Build all possible time slots for a given day, filtered by existing booked appointments. */
function getAvailableSlots(
  dateKey: string,
  durationMins: number,
  businessHours: BusinessHour[],
  bookedSlots: BookedSlot[],
  dayOfWeek: number,
): string[] {
  const hours = businessHours.find((h) => h.dayOfWeek === dayOfWeek);
  const open  = hours?.closed ? null : (hours?.openTime  ?? "08:00");
  const close = hours?.closed ? null : (hours?.closeTime ?? "18:00");
  if (!open || !close) return [];

  const [oh, om] = open.split(":").map(Number);
  const [ch, cm] = close.split(":").map(Number);
  const openMins  = oh * 60 + om;
  const closeMins = ch * 60 + cm;

  // Build booked intervals for this specific date
  const dayBooked = bookedSlots.map((slot) => {
    const startMs = slot.scheduledAt.getTime();
    return { start: startMs, end: startMs + slot.durationMins * 60 * 1000 };
  });

  const slots: string[] = [];
  for (let m = openMins; m + durationMins <= closeMins; m += 30) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    const slotTime = `${dateKey}T${hh}:${mm}:00`;
    // Convert local Bogotá slot to UTC for comparison
    // Bogotá is UTC-5 (no DST)
    const localMs = new Date(`${dateKey}T${hh}:${mm}:00-05:00`).getTime();
    const slotEnd = localMs + durationMins * 60 * 1000;
    const overlaps = dayBooked.some((b) => localMs < b.end && slotEnd > b.start);
    if (!overlaps) {
      const label = new Intl.DateTimeFormat("es-CO", { timeZone: APP_TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(new Date(localMs));
      slots.push(label === "" ? `${hh}:${mm}` : label);
    }
  }
  return slots;
}

/** Convert a Bogotá-local "HH:MM" + dateKey to a UTC ISO string */
function localSlotToUtcIso(dateKey: string, slot: string): string {
  // Bogotá is UTC-5 all year
  return new Date(`${dateKey}T${slot}:00-05:00`).toISOString();
}

/** Parse a slot label back to HH:MM 24h (the label is in es-CO format) */
function slotLabelToHHMM(slots: { label: string; hhmm: string }[], label: string): string {
  return slots.find((s) => s.label === label)?.hhmm ?? "00:00";
}

// ── Steps ─────────────────────────────────────────────────────────────────────

type Step = "service" | "datetime" | "contact" | "confirm" | "done";

// ── Component ─────────────────────────────────────────────────────────────────

export function AppointmentForm({ restaurantSlug, services, businessHours, bookedSlots }: Props) {
  const [step, setStep] = useState<Step>("service");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string>("");
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number>(0);
  const [selectedDateLabel, setSelectedDateLabel] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string>("");   // "HH:MM" 24h local
  const [selectedSlotLabel, setSelectedSlotLabel] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [error, setError] = useState("");
  const [publicToken, setPublicToken] = useState("");
  const [isPending, startTransition] = useTransition();

  const availableDates = selectedService ? getAvailableDates(businessHours) : [];

  // Build rich slot list (label + hhmm) for the selected date+service
  const rawSlots: { label: string; hhmm: string }[] = (() => {
    if (!selectedService || !selectedDateKey) return [];
    const hours = businessHours.find((h) => h.dayOfWeek === selectedDayOfWeek);
    const open  = hours?.closed ? null : (hours?.openTime  ?? "08:00");
    const close = hours?.closed ? null : (hours?.closeTime ?? "18:00");
    if (!open || !close) return [];
    const [oh, om] = open.split(":").map(Number);
    const [ch, cm] = close.split(":").map(Number);
    const openMins  = oh * 60 + om;
    const closeMins = ch * 60 + cm;

    const dayBooked = bookedSlots.map((slot) => ({
      start: slot.scheduledAt.getTime(),
      end: slot.scheduledAt.getTime() + slot.durationMins * 60 * 1000,
    }));

    const result: { label: string; hhmm: string }[] = [];
    for (let m = openMins; m + selectedService.durationMins <= closeMins; m += 30) {
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      const localMs = new Date(`${selectedDateKey}T${hh}:${mm}:00-05:00`).getTime();
      const slotEnd = localMs + selectedService.durationMins * 60 * 1000;
      const overlaps = dayBooked.some((b) => localMs < b.end && slotEnd > b.start);
      if (!overlaps) {
        const label = new Intl.DateTimeFormat("es-CO", { timeZone: APP_TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(new Date(localMs));
        result.push({ label, hhmm: `${hh}:${mm}` });
      }
    }
    return result;
  })();

  function handleSubmit() {
    if (!selectedService || !selectedDateKey || !selectedSlot) return;
    const scheduledAtIso = localSlotToUtcIso(selectedDateKey, selectedSlot);
    setError("");
    startTransition(async () => {
      try {
        const result = await bookAppointment({
          restaurantSlug,
          serviceId: selectedService.id,
          scheduledAt: scheduledAtIso,
          clientName,
          clientPhone,
        });
        setPublicToken(result.publicToken);
        setStep("done");
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo agendar. Intenta de nuevo.");
      }
    });
  }

  if (step === "done") {
    return (
      <section className="card text-center space-y-4">
        <div className="text-4xl">✂️</div>
        <h2 className="text-xl font-bold">¡Cita agendada!</h2>
        <p className="text-stone-600">
          Tu cita de <strong>{selectedService?.name}</strong> quedó agendada para el{" "}
          <strong>{selectedDateLabel}</strong> a las <strong>{selectedSlotLabel}</strong>.
        </p>
        <p className="text-stone-500 text-sm">Te esperamos. Puedes llamarnos si necesitas cambiar el horario.</p>
        <button
          className="button-secondary"
          onClick={() => {
            setStep("service");
            setSelectedService(null);
            setSelectedDateKey("");
            setSelectedSlot("");
            setClientName("");
            setClientPhone("");
          }}
        >
          Agendar otra cita
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Step 1: service selection ── */}
      {step === "service" && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Elige un servicio</h2>
          {services.length === 0 ? (
            <p className="text-stone-500">No hay servicios disponibles en este momento.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {services.map((svc) => (
                <button
                  key={svc.id}
                  className="card text-left hover:border-brand-blue hover:shadow-md transition"
                  onClick={() => { setSelectedService(svc); setSelectedDateKey(""); setSelectedSlot(""); setStep("datetime"); }}
                >
                  <p className="font-semibold text-stone-900">{svc.name}</p>
                  {svc.description && <p className="text-sm text-stone-500 mt-0.5">{svc.description}</p>}
                  <div className="mt-2 flex items-center gap-3 text-sm text-stone-600">
                    <span>⏱ {svc.durationMins} min</span>
                    <span className="font-semibold text-stone-900">{formatMoney(svc.price)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Step 2: date + time ── */}
      {step === "datetime" && selectedService && (
        <section className="space-y-5">
          <button className="text-sm text-brand-blue hover:underline" onClick={() => setStep("service")}>
            ← Cambiar servicio
          </button>

          <div className="card">
            <p className="text-sm text-stone-500">Servicio seleccionado</p>
            <p className="font-semibold">{selectedService.name} · {selectedService.durationMins} min · {formatMoney(selectedService.price)}</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">Elige una fecha</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {availableDates.map((d) => (
                <button
                  key={d.dateKey}
                  className={`rounded-xl border px-3 py-2.5 text-sm text-left transition ${
                    selectedDateKey === d.dateKey
                      ? "border-brand-blue bg-brand-blue/5 font-semibold text-brand-blue"
                      : "border-stone-200 hover:border-stone-300"
                  }`}
                  onClick={() => { setSelectedDateKey(d.dateKey); setSelectedDayOfWeek(d.dayOfWeek); setSelectedDateLabel(d.label); setSelectedSlot(""); setSelectedSlotLabel(""); }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {selectedDateKey && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Elige un horario</h2>
              {rawSlots.length === 0 ? (
                <p className="text-stone-500">No hay horarios disponibles para este día.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {rawSlots.map((s) => (
                    <button
                      key={s.hhmm}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                        selectedSlot === s.hhmm
                          ? "border-brand-blue bg-brand-blue/5 text-brand-blue"
                          : "border-stone-200 hover:border-stone-300"
                      }`}
                      onClick={() => { setSelectedSlot(s.hhmm); setSelectedSlotLabel(s.label); }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedDateKey && selectedSlot && (
            <button
              className="button-primary w-full"
              onClick={() => setStep("contact")}
            >
              Continuar
            </button>
          )}
        </section>
      )}

      {/* ── Step 3: contact info ── */}
      {step === "contact" && selectedService && (
        <section className="space-y-5">
          <button className="text-sm text-brand-blue hover:underline" onClick={() => setStep("datetime")}>
            ← Cambiar fecha u hora
          </button>

          <div className="card">
            <p className="text-sm text-stone-500">Tu cita</p>
            <p className="font-semibold">{selectedService.name}</p>
            <p className="text-sm text-stone-600">{selectedDateLabel} · {selectedSlotLabel}</p>
          </div>

          <div className="card space-y-4">
            <h2 className="text-lg font-semibold">Tus datos</h2>

            <div>
              <label className="label" htmlFor="appt-name">Nombre completo</label>
              <input
                className="input"
                id="appt-name"
                onChange={(e) => setClientName(e.target.value)}
                placeholder="María García"
                type="text"
                value={clientName}
              />
            </div>

            <div>
              <label className="label" htmlFor="appt-phone">Teléfono</label>
              <input
                className="input"
                id="appt-phone"
                inputMode="tel"
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="3001234567"
                type="tel"
                value={clientPhone}
              />
            </div>

            {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

            <button
              className="button-primary w-full"
              disabled={!clientName.trim() || !clientPhone.trim() || isPending}
              onClick={() => setStep("confirm")}
            >
              Revisar cita
            </button>
          </div>
        </section>
      )}

      {/* ── Step 4: confirmation ── */}
      {step === "confirm" && selectedService && (
        <section className="space-y-5">
          <button className="text-sm text-brand-blue hover:underline" onClick={() => setStep("contact")}>
            ← Editar datos
          </button>

          <div className="card space-y-3">
            <h2 className="text-lg font-semibold">Confirma tu cita</h2>
            <div className="divide-y divide-stone-100 text-sm">
              <div className="flex justify-between py-2"><span className="text-stone-500">Servicio</span><span className="font-medium">{selectedService.name}</span></div>
              <div className="flex justify-between py-2"><span className="text-stone-500">Duración</span><span className="font-medium">{selectedService.durationMins} min</span></div>
              <div className="flex justify-between py-2"><span className="text-stone-500">Precio</span><span className="font-medium">{formatMoney(selectedService.price)}</span></div>
              <div className="flex justify-between py-2"><span className="text-stone-500">Fecha</span><span className="font-medium">{selectedDateLabel}</span></div>
              <div className="flex justify-between py-2"><span className="text-stone-500">Hora</span><span className="font-medium">{selectedSlotLabel}</span></div>
              <div className="flex justify-between py-2"><span className="text-stone-500">Nombre</span><span className="font-medium">{clientName}</span></div>
              <div className="flex justify-between py-2"><span className="text-stone-500">Teléfono</span><span className="font-medium">{clientPhone}</span></div>
            </div>

            {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

            <button
              className="button-primary w-full"
              disabled={isPending}
              onClick={handleSubmit}
            >
              {isPending ? "Agendando…" : "Confirmar cita"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
