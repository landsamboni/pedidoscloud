"use client";

import { useActionState, useState } from "react";
import { createService, updateService, deleteService, saveBusinessHours, type ActionState } from "@/app/actions";
import { formatMoney } from "@/lib/format";

type Service = {
  id: string;
  name: string;
  description: string | null;
  durationMins: number;
  price: string;
  active: boolean;
  position: number;
};

type BusinessHour = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  closed: boolean;
};

const INIT: ActionState = { ok: false, message: "", ts: 0 };

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// Default business hours: Mon–Sat 8am–6pm
const DEFAULT_HOURS: BusinessHour[] = Array.from({ length: 7 }, (_, i) => ({
  dayOfWeek: i,
  openTime: "08:00",
  closeTime: "18:00",
  closed: i === 0, // Sunday closed by default
}));

// ── Service form (create / edit) ──────────────────────────────────────────────

function ServiceForm({
  restaurantId,
  initial,
  onDone,
}: {
  restaurantId: string;
  initial?: Service;
  onDone: () => void;
}) {
  const action = initial ? updateService : createService;
  const [state, formAction, isPending] = useActionState(action, INIT);

  return (
    <form action={formAction} className="space-y-4" onSubmit={() => { if (state.ok) onDone(); }}>
      {initial && <input name="serviceId" type="hidden" value={initial.id} />}
      {!initial && <input name="restaurantId" type="hidden" value={restaurantId} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="svc-name">Nombre del servicio</label>
          <input className="input" defaultValue={initial?.name} id="svc-name" name="name" placeholder="Corte clásico" required type="text" />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="svc-desc">Descripción (opcional)</label>
          <input className="input" defaultValue={initial?.description ?? ""} id="svc-desc" name="description" placeholder="Corte con tijera y máquina, lavado incluido" type="text" />
        </div>

        <div>
          <label className="label" htmlFor="svc-duration">Duración (minutos)</label>
          <input className="input" defaultValue={initial?.durationMins ?? 30} id="svc-duration" min={5} max={480} name="durationMins" required step={5} type="number" />
        </div>

        <div>
          <label className="label" htmlFor="svc-price">Precio (COP)</label>
          <input className="input" defaultValue={initial ? Number(initial.price) : ""} id="svc-price" min={0} name="price" required step={100} type="number" />
        </div>

        {initial && (
          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              defaultChecked={initial.active}
              id="svc-active"
              name="active"
              type="checkbox"
              value="true"
              onChange={(e) => {
                const form = e.target.form;
                if (form) {
                  const hidden = form.querySelector<HTMLInputElement>('input[name="active"][type="hidden"]');
                  if (hidden) hidden.value = e.target.checked ? "true" : "false";
                }
              }}
            />
            {/* Hidden fallback so unchecked checkbox still submits a value */}
            <input name="active" type="hidden" value={initial.active ? "true" : "false"} />
            <label className="text-sm font-medium text-stone-700" htmlFor="svc-active">Servicio activo (visible para clientes)</label>
          </div>
        )}
      </div>

      {state.message && (
        <p className={`rounded-lg px-4 py-2 text-sm ${state.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {state.message}
        </p>
      )}

      <div className="flex gap-2">
        <button className="button-primary" disabled={isPending} type="submit">
          {isPending ? "Guardando…" : initial ? "Guardar cambios" : "Crear servicio"}
        </button>
        <button className="button-secondary" onClick={onDone} type="button">Cancelar</button>
      </div>
    </form>
  );
}

// ── Business hours form ───────────────────────────────────────────────────────

function BusinessHoursForm({ restaurantId, initial }: { restaurantId: string; initial: BusinessHour[] }) {
  const [hours, setHours] = useState<BusinessHour[]>(() => {
    // Fill in defaults for any missing days
    return DEFAULT_HOURS.map((def) => {
      const existing = initial.find((h) => h.dayOfWeek === def.dayOfWeek);
      return existing ?? def;
    });
  });
  const [state, formAction, isPending] = useActionState(saveBusinessHours, INIT);

  function update(dow: number, field: keyof BusinessHour, value: string | boolean) {
    setHours((prev) => prev.map((h) => h.dayOfWeek === dow ? { ...h, [field]: value } : h));
  }

  return (
    <form
      action={formAction}
      className="space-y-4"
    >
      <input name="restaurantId" type="hidden" value={restaurantId} />
      <input name="hours" type="hidden" value={JSON.stringify(hours)} />

      <div className="space-y-2">
        {hours.map((h) => (
          <div key={h.dayOfWeek} className="flex items-center gap-3 py-1">
            <span className="w-24 text-sm font-medium text-stone-700">{DAY_NAMES[h.dayOfWeek]}</span>
            <input
              checked={h.closed}
              className="accent-brand-blue"
              id={`closed-${h.dayOfWeek}`}
              onChange={(e) => update(h.dayOfWeek, "closed", e.target.checked)}
              type="checkbox"
            />
            <label className="text-sm text-stone-500" htmlFor={`closed-${h.dayOfWeek}`}>Cerrado</label>

            {!h.closed && (
              <>
                <input
                  className="input w-28 text-sm"
                  onChange={(e) => update(h.dayOfWeek, "openTime", e.target.value)}
                  required
                  type="time"
                  value={h.openTime}
                />
                <span className="text-stone-400">–</span>
                <input
                  className="input w-28 text-sm"
                  onChange={(e) => update(h.dayOfWeek, "closeTime", e.target.value)}
                  required
                  type="time"
                  value={h.closeTime}
                />
              </>
            )}
          </div>
        ))}
      </div>

      {state.message && (
        <p className={`rounded-lg px-4 py-2 text-sm ${state.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {state.message}
        </p>
      )}

      <button className="button-primary" disabled={isPending} type="submit">
        {isPending ? "Guardando…" : "Guardar horario"}
      </button>
    </form>
  );
}

// ── Delete service button ─────────────────────────────────────────────────────

function DeleteServiceButton({ serviceId, serviceName }: { serviceId: string; serviceName: string }) {
  const [state, formAction, isPending] = useActionState(deleteService, INIT);

  return (
    <form action={formAction}>
      <input name="serviceId" type="hidden" value={serviceId} />
      {state.message && !state.ok && (
        <p className="mb-1 text-xs text-red-600">{state.message}</p>
      )}
      <button
        className="text-xs text-red-500 hover:underline disabled:opacity-50"
        disabled={isPending}
        onClick={(e) => {
          if (!confirm(`¿Eliminar "${serviceName}"? Esta acción no se puede deshacer.`)) e.preventDefault();
        }}
        type="submit"
      >
        Eliminar
      </button>
    </form>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────

interface Props {
  restaurantId: string;
  services: Service[];
  businessHours: BusinessHour[];
}

export function ServicesEditor({ restaurantId, services, businessHours }: Props) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"services" | "hours">("services");

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1 mb-6 w-fit">
        {(["services", "hours"] as const).map((t) => (
          <button
            key={t}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${tab === t ? "bg-white shadow-sm text-stone-900" : "text-stone-500 hover:text-stone-700"}`}
            onClick={() => setTab(t)}
          >
            {t === "services" ? "Servicios" : "Horario"}
          </button>
        ))}
      </div>

      {tab === "services" && (
        <div className="space-y-4">
          {/* Service list */}
          {services.map((svc) => (
            <div key={svc.id} className="card">
              {editingId === svc.id ? (
                <ServiceForm
                  initial={svc}
                  restaurantId={restaurantId}
                  onDone={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-stone-900">{svc.name}</p>
                      {!svc.active && (
                        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">Inactivo</span>
                      )}
                    </div>
                    {svc.description && <p className="text-sm text-stone-500 mt-0.5">{svc.description}</p>}
                    <div className="mt-1 flex items-center gap-3 text-sm text-stone-600">
                      <span>⏱ {svc.durationMins} min</span>
                      <span className="font-semibold text-stone-900">{formatMoney(Number(svc.price))}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      className="text-xs font-medium text-brand-blue hover:underline"
                      onClick={() => setEditingId(svc.id)}
                    >
                      Editar
                    </button>
                    <DeleteServiceButton serviceName={svc.name} serviceId={svc.id} />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Create service */}
          {creating ? (
            <div className="card">
              <h3 className="font-semibold mb-4">Nuevo servicio</h3>
              <ServiceForm restaurantId={restaurantId} onDone={() => setCreating(false)} />
            </div>
          ) : (
            <button className="button-secondary w-full" onClick={() => setCreating(true)}>
              + Agregar servicio
            </button>
          )}
        </div>
      )}

      {tab === "hours" && (
        <div className="card">
          <h3 className="font-semibold mb-4">Horario de atención</h3>
          <BusinessHoursForm initial={businessHours} restaurantId={restaurantId} />
        </div>
      )}
    </div>
  );
}
