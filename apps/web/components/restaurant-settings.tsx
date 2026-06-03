import { createPaymentMethod, deletePaymentMethod, setRestaurantPassword, updateBasePrice, updatePaymentSettings, updateTodayMenu } from "@/app/actions";
import { AutoGrowTextarea } from "@/components/auto-grow-textarea";

type Menu = {
  soups: string[];
  proteins: string[];
  sides: string[];
  drinks: string[];
} | undefined;

type PaymentMethod = { id: string; label: string; phone: string; accountName: string };

type Restaurant = {
  id: string;
  basePrice: { toString(): string };
  nequiPhone: string | null;
  nequiAccountName: string | null;
  nequiQrPath: string | null;
  whatsappPhone: string | null;
  passwordHash: string | null;
  paymentMethods: PaymentMethod[];
};

export function RestaurantSettings({ menu, restaurant, returnPath, hidePassword = false, menuPublishedToday = false }: { menu: Menu; restaurant: Restaurant; returnPath: string; hidePassword?: boolean; menuPublishedToday?: boolean }) {
  const hasTemplate = !!menu && [menu.soups, menu.proteins, menu.sides, menu.drinks].some((o) => o.length > 0);
  return (
    <div className="space-y-3">
      <details className="rounded-xl border border-stone-200 p-4">
        <summary className="cursor-pointer text-lg font-semibold">Cambiar precio del almuerzo</summary>
        <form action={updateBasePrice} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input name="restaurantId" type="hidden" value={restaurant.id} />
          <input name="returnPath" type="hidden" value={returnPath} />
          <label className="text-sm font-medium text-stone-700">
            Precio base de cada almuerzo
            <input className="input mt-1 text-base" defaultValue={restaurant.basePrice.toString()} min="1" name="basePrice" required step="1" type="number" />
          </label>
          <button className="button-primary self-end">Guardar precio</button>
        </form>
      </details>

      <details className="rounded-xl border border-stone-200 p-4" open={!menuPublishedToday}>
        <summary className="cursor-pointer text-lg font-semibold">
          Editar menú de hoy
          {!menuPublishedToday && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-xs font-semibold text-amber-700">
              Pendiente de publicar
            </span>
          )}
        </summary>
        <form action={updateTodayMenu} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input name="restaurantId" type="hidden" value={restaurant.id} />
          <input name="returnPath" type="hidden" value={returnPath} />

          {menuPublishedToday ? (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 sm:col-span-2">
              ✓ El menú de hoy ya está publicado y visible para tus clientes. Edítalo y guarda para actualizarlo.
            </p>
          ) : hasTemplate ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 sm:col-span-2">
              Estás viendo tu <strong>último menú</strong> como base. Tus clientes <strong>no</strong> lo ven todavía: ajusta lo que cambie hoy y pulsa <strong>Publicar menú de hoy</strong>.
            </p>
          ) : (
            <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600 sm:col-span-2">
              Aún no hay menú para hoy. Escríbelo y pulsa <strong>Publicar menú de hoy</strong>.
            </p>
          )}

          <MenuTextarea label="Sopas" name="soups" options={menu?.soups} />
          <MenuTextarea label="Proteínas" name="proteins" options={menu?.proteins} />
          <MenuTextarea label="Principios" name="sides" options={menu?.sides} />
          <MenuTextarea label="Bebidas" name="drinks" options={menu?.drinks} />
          <button className="button-primary sm:col-span-2">
            {menuPublishedToday ? "Guardar menú" : "Publicar menú de hoy"}
          </button>
        </form>
      </details>

      <details className="rounded-xl border border-stone-200 p-4">
        <summary className="cursor-pointer text-lg font-semibold">Nequi principal y WhatsApp</summary>
        <form action={updatePaymentSettings} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input name="restaurantId" type="hidden" value={restaurant.id} />
          <input name="returnPath" type="hidden" value={returnPath} />
          <label className="text-sm font-medium text-stone-700">
            Celular o llave Nequi
            <input className="input mt-1" defaultValue={restaurant.nequiPhone ?? ""} name="nequiPhone" placeholder="3001234567" required />
          </label>
          <label className="text-sm font-medium text-stone-700">
            Nombre del titular
            <input className="input mt-1" defaultValue={restaurant.nequiAccountName ?? ""} name="nequiAccountName" placeholder="Nombre o negocio" required />
          </label>
          <label className="text-sm font-medium text-stone-700 sm:col-span-2">
            WhatsApp del restaurante{" "}
            <span className="font-normal text-stone-400">(para el botón "Preguntar por WhatsApp" del cliente)</span>
            <input
              className="input mt-1"
              defaultValue={restaurant.whatsappPhone ?? ""}
              inputMode="tel"
              maxLength={10}
              name="whatsappPhone"
              placeholder="3001234567 (dejar vacío para usar el Nequi)"
            />
          </label>
          <label className="text-sm font-medium text-stone-700 sm:col-span-2">
            QR Nequi <span className="font-normal text-stone-400">(opcional, deja vacío para conservar el actual)</span>
            <input accept="image/jpeg,image/png,image/webp" className="input mt-1" name="nequiQr" type="file" />
          </label>
          {restaurant.nequiQrPath && <p className="text-sm text-teal-600 sm:col-span-2">QR configurado actualmente.</p>}
          <button className="button-primary sm:col-span-2">Guardar datos de Nequi</button>
        </form>
      </details>

      <details className="rounded-xl border border-stone-200 p-4" open={restaurant.paymentMethods.length > 0}>
        <summary className="cursor-pointer text-lg font-semibold">
          Otros medios de pago{" "}
          <span className="ml-1 text-sm font-normal text-stone-400">(Daviplata, segunda llave, Bancolombia…)</span>
        </summary>

        {restaurant.paymentMethods.length > 0 && (
          <ul className="mt-4 space-y-2">
            {restaurant.paymentMethods.map((m) => (
              <li className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 p-3" key={m.id}>
                <div className="text-sm">
                  <p className="font-semibold">{m.label}</p>
                  <p className="text-stone-600">{m.phone} · {m.accountName}</p>
                </div>
                <form action={deletePaymentMethod}>
                  <input name="id" type="hidden" value={m.id} />
                  <input name="restaurantId" type="hidden" value={restaurant.id} />
                  <input name="returnPath" type="hidden" value={returnPath} />
                  <button className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50" type="submit">
                    Eliminar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={createPaymentMethod} className="mt-4 grid gap-3 sm:grid-cols-3">
          <input name="restaurantId" type="hidden" value={restaurant.id} />
          <input name="returnPath" type="hidden" value={returnPath} />
          <label className="text-sm font-medium text-stone-700">
            Tipo <span className="font-normal text-stone-400">(ej. Daviplata)</span>
            <input className="input mt-1" name="label" placeholder="Daviplata" required />
          </label>
          <label className="text-sm font-medium text-stone-700">
            Número o llave
            <input className="input mt-1" inputMode="tel" name="phone" placeholder="3001234567" required />
          </label>
          <label className="text-sm font-medium text-stone-700">
            Titular
            <input className="input mt-1" name="accountName" placeholder="Nombre" required />
          </label>
          <button className="button-secondary sm:col-span-3">+ Agregar método de pago</button>
        </form>
      </details>
      {/* Password section — only shown to admin (hidePassword=true in restaurant console) */}
      {!hidePassword && (
        <div className="mt-4 border-t border-stone-200 pt-6">
          <details className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <summary className="cursor-pointer text-lg font-semibold text-amber-900">
              Contraseña de acceso
            </summary>
            <p className="mt-1 text-xs text-amber-700">
              Configura o cambia la contraseña que usa el agente del restaurante para iniciar sesión.
            </p>
            <form action={setRestaurantPassword} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input name="restaurantId" type="hidden" value={restaurant.id} />
              <label className="text-sm font-medium text-stone-700">
                Nueva contraseña <span className="font-normal text-stone-400">(mínimo 8 caracteres)</span>
                <input className="input mt-1" minLength={8} name="password" placeholder="Nueva contraseña" required type="password" />
              </label>
              <button className="button-primary self-end">
                {restaurant.passwordHash ? "Cambiar contraseña" : "Establecer contraseña"}
              </button>
            </form>
            {!restaurant.passwordHash && (
              <p className="mt-2 text-sm text-amber-800">⚠ Este restaurante aún no tiene contraseña. El agente no podrá iniciar sesión hasta que la establezcas.</p>
            )}
          </details>
        </div>
      )}
    </div>
  );
}

function MenuTextarea({ label, name, options = [] }: { label: string; name: string; options?: string[] }) {
  return (
    <label className="text-sm font-medium text-stone-700">
      {label}{" "}
      <span className="font-normal text-stone-400">
        (una por línea · precio extra: <code className="rounded bg-stone-100 px-1 text-xs">Costilla BBQ +3000</code>)
      </span>
      <AutoGrowTextarea
        className="input mt-1 min-h-36 resize-none overflow-hidden font-mono text-sm leading-relaxed"
        defaultValue={options.join("\n")}
        name={name}
        // Initial height ~ number of options so it renders close to its final
        // size before hydration fine-tunes it; AutoGrowTextarea removes any scroll.
        rows={Math.max(options.length + 2, 6)}
        required
      />
    </label>
  );
}
