"use client";

import { useActionState } from "react";
import {
  createRestaurantUser,
  deleteRestaurantUser,
  resetRestaurantUserPassword,
  toggleRestaurantUserActive,
} from "@/app/actions";
import type { ActionState } from "@/app/actions";

const INIT: ActionState = { ok: false, message: "", ts: 0 };

type RestaurantUser = {
  id: string;
  username: string;
  displayName: string;
  active: boolean;
  createdAt: Date;
};

function UserRow({ user, restaurantSlug }: { user: RestaurantUser; restaurantSlug: string }) {
  const [toggleState, toggleAction] = useActionState(toggleRestaurantUserActive, INIT);
  const [deleteState, deleteAction] = useActionState(deleteRestaurantUser, INIT);
  const [pwState, pwAction] = useActionState(resetRestaurantUserPassword, INIT);

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-stone-900">
            <span className="font-mono text-sm bg-stone-100 px-1.5 py-0.5 rounded">{user.username}</span>
            {user.displayName && <span className="ml-2 text-stone-500 text-sm">{user.displayName}</span>}
          </p>
          <p className="text-xs text-stone-400 mt-0.5">
            Creado el {new Date(user.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${user.active ? "bg-emerald-100 text-emerald-700" : "bg-stone-200 text-stone-500"}`}>
          {user.active ? "Activo" : "Inactivo"}
        </span>
      </div>

      {/* Reset password */}
      <details className="text-sm">
        <summary className="cursor-pointer text-brand-blue hover:underline">Cambiar contraseña</summary>
        <form action={pwAction} className="mt-2 flex gap-2">
          <input name="userId" type="hidden" value={user.id} />
          <input className="input text-sm flex-1" minLength={8} name="password" placeholder="Nueva contraseña (mín. 8 chars)" required type="password" />
          <button className="button-secondary text-sm shrink-0" type="submit">Guardar</button>
        </form>
        {pwState.message && <p className={`mt-1 text-xs ${pwState.ok ? "text-emerald-600" : "text-red-600"}`}>{pwState.message}</p>}
      </details>

      <div className="flex gap-2 pt-1 border-t border-stone-100">
        {/* Toggle active */}
        <form action={toggleAction}>
          <input name="userId" type="hidden" value={user.id} />
          <button className="button-secondary text-xs py-1.5" type="submit">
            {user.active ? "Desactivar" : "Activar"}
          </button>
        </form>
        {toggleState.message && <span className="text-xs text-stone-500 self-center">{toggleState.message}</span>}

        {/* Delete */}
        <form action={deleteAction} onSubmit={(e) => { if (!confirm(`¿Eliminar usuario "${user.username}"?`)) e.preventDefault(); }}>
          <input name="userId" type="hidden" value={user.id} />
          <button className="button-secondary text-xs py-1.5 text-red-600 border-red-200 hover:bg-red-50" type="submit">
            Eliminar
          </button>
        </form>
      </div>
    </div>
  );
}

export function RestaurantUsersPanel({
  restaurantId,
  restaurantSlug,
  users,
}: {
  restaurantId: string;
  restaurantSlug: string;
  users: RestaurantUser[];
}) {
  const [createState, createAction] = useActionState(createRestaurantUser, INIT);

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500">
        Usuarios adicionales para este restaurante. Solo tú como administrador puedes gestionarlos.
        Cada uno puede iniciar sesión con su usuario y contraseña.
      </p>

      {/* Existing users */}
      {users.length > 0 ? (
        <div className="space-y-3">
          {users.map((u) => (
            <UserRow key={u.id} restaurantSlug={restaurantSlug} user={u} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-stone-400 italic">Sin usuarios adicionales configurados.</p>
      )}

      {/* Create new user */}
      <details className="rounded-xl border border-stone-200 bg-stone-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-brand-blue">+ Agregar usuario</summary>
        <form action={createAction} className="mt-3 space-y-2">
          <input name="restaurantId" type="hidden" value={restaurantId} />
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1">
                Usuario (para iniciar sesión)
                <span className="text-stone-400 font-normal"> — solo minúsculas, números y guiones</span>
              </label>
              <input
                className="input text-sm"
                maxLength={50}
                minLength={3}
                name="username"
                pattern="[a-z0-9-]+"
                placeholder="ej. panza-feliz-2"
                required
                title="Solo minúsculas, números y guiones"
                type="text"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1">Nombre descriptivo (opcional)</label>
              <input className="input text-sm" maxLength={60} name="displayName" placeholder="ej. Turno mañana" type="text" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1">Contraseña (mín. 8 caracteres)</label>
            <input className="input text-sm" minLength={8} name="password" placeholder="Contraseña" required type="password" />
          </div>
          <button className="button-primary text-sm" type="submit">Crear usuario</button>
          {createState.message && (
            <p className={`text-xs font-medium ${createState.ok ? "text-emerald-600" : "text-red-600"}`}>
              {createState.message}
            </p>
          )}
        </form>
      </details>
    </div>
  );
}
