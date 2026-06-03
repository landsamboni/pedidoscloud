import { createPaymentMethod, deletePaymentMethod, setRestaurantPassword, updateBasePrice, updateBusinessPhone, updateMenuTemplate, updatePaymentSettings, updateTodayMenu } from "@/app/actions";
import { MenuFields } from "@/components/menu-fields";
import { ShareMenuImage } from "@/components/share-menu-image";

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
  menuTemplatePath: string | null;
  paymentMethods: PaymentMethod[];
};

export function RestaurantSettings({ menu, restaurant, returnPath, restaurantSlug, hidePassword = false, menuPublishedToday = false }: { menu: Menu; restaurant: Restaurant; returnPath: string; restaurantSlug: string; hidePassword?: boolean; menuPublishedToday?: boolean }) {
  const hasTemplate = !!menu && [menu.soups, menu.proteins, menu.sides, menu.drinks].some((o) => o.length > 0);
  // Changes whenever the menu content changes, used to bust the menu-image cache
  // so the preview/share always reflect the latest saved menu.
  const menuVersion = menu ? [menu.soups, menu.proteins, menu.sides, menu.drinks].map((a) => a.join("␟")).join("␞") : "";
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-stone-200 p-4">
        <h3 className="text-lg font-semibold">Teléfono / WhatsApp del negocio</h3>
        <form action={updateBusinessPhone} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input name="restaurantId" type="hidden" value={restaurant.id} />
          <input name="returnPath" type="hidden" value={returnPath} />
          <label className="text-sm font-medium text-stone-700">
            Número de contacto y WhatsApp <span className="font-normal text-stone-400">(el mismo número; lo usa el botón "Preguntar por WhatsApp" del cliente)</span>
            <input className="input mt-1 text-base" defaultValue={restaurant.whatsappPhone ?? ""} inputMode="tel" maxLength={10} name="whatsappPhone" placeholder="3001234567" />
          </label>
          <button className="button-primary self-end">Guardar número</button>
        </form>
      </div>

      <div className="rounded-xl border border-stone-200 p-4">
        <h3 className="text-lg font-semibold">Precio del almuerzo</h3>
        <form action={updateBasePrice} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input name="restaurantId" type="hidden" value={restaurant.id} />
          <input name="returnPath" type="hidden" value={returnPath} />
          <label className="text-sm font-medium text-stone-700">
            Precio base de cada almuerzo
            <input className="input mt-1 text-base" defaultValue={restaurant.basePrice.toString()} min="1" name="basePrice" required step="1" type="number" />
          </label>
          <button className="button-primary self-end">Guardar precio</button>
        </form>
      </div>

      <div className="rounded-xl border border-stone-200 p-4">
        <h3 className="text-lg font-semibold">
          Editar menú de hoy
          {!menuPublishedToday && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-xs font-semibold text-amber-700">
              Pendiente de publicar
            </span>
          )}
        </h3>
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

          <MenuFields
            values={{
              soups: menu?.soups.join("\n"),
              proteins: menu?.proteins.join("\n"),
              sides: menu?.sides.join("\n"),
              drinks: menu?.drinks.join("\n"),
            }}
          />
          <button className="button-primary sm:col-span-2">
            {menuPublishedToday ? "Guardar menú" : "Publicar menú de hoy"}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-stone-200 p-4">
        <h3 className="text-lg font-semibold">Imagen del menú para compartir</h3>
        <p className="mt-1 text-sm text-stone-500">
          Genera una imagen (1080×1350) con el menú de hoy para tus estados de WhatsApp.
        </p>
        <div className="mt-4">
          <ShareMenuImage hasTemplate={!!restaurant.menuTemplatePath} publishedToday={menuPublishedToday} slug={restaurantSlug} version={menuVersion} />
        </div>
        <form action={updateMenuTemplate} className="mt-4 grid gap-3 border-t border-stone-100 pt-4 sm:grid-cols-[1fr_auto]">
          <input name="restaurantId" type="hidden" value={restaurant.id} />
          <input name="returnPath" type="hidden" value={returnPath} />
          <label className="text-sm font-medium text-stone-700">
            Plantilla de fondo <span className="font-normal text-stone-400">(PNG/JPG/WEBP, 1080×1350; deja libre el centro para el texto)</span>
            <input accept="image/jpeg,image/png,image/webp" className="input mt-1" name="menuTemplate" required type="file" />
          </label>
          <button className="button-primary self-end">{restaurant.menuTemplatePath ? "Cambiar plantilla" : "Subir plantilla"}</button>
        </form>
        {restaurant.menuTemplatePath && <p className="mt-2 text-sm text-teal-600">Plantilla configurada.</p>}
      </div>

      <div className="rounded-xl border border-stone-200 p-4">
        <h3 className="text-lg font-semibold">Medios de pago</h3>
        <p className="mt-1 text-sm text-stone-500">Datos que verá el cliente para pagar y subir su comprobante.</p>

        {/* Nequi principal (con QR) */}
        <form action={updatePaymentSettings} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input name="restaurantId" type="hidden" value={restaurant.id} />
          <input name="returnPath" type="hidden" value={returnPath} />
          <p className="text-sm font-semibold text-stone-700 sm:col-span-2">Nequi (principal)</p>
          <label className="text-sm font-medium text-stone-700">
            Celular o llave Nequi
            <input className="input mt-1" defaultValue={restaurant.nequiPhone ?? ""} name="nequiPhone" placeholder="3001234567" required />
          </label>
          <label className="text-sm font-medium text-stone-700">
            Nombre del titular
            <input className="input mt-1" defaultValue={restaurant.nequiAccountName ?? ""} name="nequiAccountName" placeholder="Nombre o negocio" required />
          </label>
          <label className="text-sm font-medium text-stone-700 sm:col-span-2">
            QR Nequi <span className="font-normal text-stone-400">(opcional, deja vacío para conservar el actual)</span>
            <input accept="image/jpeg,image/png,image/webp" className="input mt-1" name="nequiQr" type="file" />
          </label>
          {restaurant.nequiQrPath && <p className="text-sm text-teal-600 sm:col-span-2">QR configurado actualmente.</p>}
          <button className="button-primary sm:col-span-2">Guardar Nequi</button>
        </form>

        {/* Otros medios de pago */}
        <div className="mt-6 border-t border-stone-100 pt-4">
          <p className="text-sm font-semibold text-stone-700">
            Otros medios <span className="font-normal text-stone-400">(Daviplata, segunda llave, Bancolombia…)</span>
          </p>

          {restaurant.paymentMethods.length > 0 && (
            <ul className="mt-3 space-y-2">
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
        </div>
      </div>
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
