import { deletePaymentMethod, resetMenuTemplates, selectMenuTemplate, setRestaurantPassword, updateBasePrice, updateMenuTemplate, updateMenuType, updatePaymentSettings } from "@/app/actions";
import { FeedbackForm, FileInput, SubmitButton } from "@/components/feedback-form";
import { CatalogMenuEditor } from "@/components/catalog-menu-editor";
import { DeliveryForm } from "@/components/delivery-form";
import { MenuEditor } from "@/components/menu-editor";
import { PaymentMethodForm } from "@/components/payment-method-form";
import { ShareMenuImage } from "@/components/share-menu-image";
import { resolveFileUrl } from "@/lib/file-url";
import { PRESET_TEMPLATES } from "@/lib/menu-image/template-spec";

type Menu = {
  soups: string[];
  proteins: string[];
  sides: string[];
  drinks: string[];
} | undefined;

type PaymentMethod = { id: string; label: string; phone: string; accountName: string; qrPath: string | null; accountType: string | null; idNumber: string | null };

type CatalogItem = { id: string; name: string; price: { toString(): string } };
type CatalogCategory = { id: string; name: string; items: CatalogItem[] };

type Restaurant = {
  id: string;
  basePrice: { toString(): string };
  menuType: string;
  orderUnitLabel: string;
  nequiPhone: string | null;
  nequiAccountName: string | null;
  nequiQrPath: string | null;
  whatsappPhone: string | null;
  passwordHash: string | null;
  menuTemplatePath: string | null;
  menuTemplateHistory: string[];
  logoPath: string | null;
  deliveryMode: string;
  deliveryFee: { toString(): string } | null;
  deliveryNote: string | null;
  allowPickup: boolean;
  paymentMethods: PaymentMethod[];
};

export function RestaurantSettings({ menu, restaurant, returnPath, restaurantSlug, catalogCategories = [], hidePassword = false, menuPublishedToday = false }: { menu: Menu; restaurant: Restaurant; returnPath: string; restaurantSlug: string; catalogCategories?: CatalogCategory[]; hidePassword?: boolean; menuPublishedToday?: boolean }) {
  const isCatalog = restaurant.menuType === "catalog";
  const hasTemplate = !!menu && (!isCatalog ? [menu.soups, menu.proteins, menu.sides, menu.drinks].some((o) => o.length > 0) : catalogCategories.length > 0);
  // Changes whenever the menu content changes, used to bust the menu-image cache
  // so the preview/share always reflect the latest saved menu.
  const menuVersion =
    (menu ? [menu.soups, menu.proteins, menu.sides, menu.drinks].map((a) => a.join("␟")).join("␞") : "") +
    "‖" + (restaurant.menuTemplatePath ?? "") +
    "‖" + (restaurant.logoPath ?? ""); // include logo so restoring/changing it also refreshes the image
  // Selectable backgrounds: latest uploads first, then presets, up to 4.
  const templateSlots = Array.from(new Set([...(restaurant.menuTemplateHistory ?? []), ...PRESET_TEMPLATES])).slice(0, 4);
  return (
    <div className="space-y-3">
      {/* Menu type selector */}
      <div className="rounded-xl border border-stone-200 p-4">
        <h3 className="text-lg font-semibold">Tipo de negocio</h3>
        <FeedbackForm action={updateMenuType} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input name="restaurantId" type="hidden" value={restaurant.id} />
          <input name="returnPath" type="hidden" value={returnPath} />
          <label className="text-sm font-medium text-stone-700 sm:col-span-2">
            Modo del menú
            <select className="input mt-1" defaultValue={restaurant.menuType} name="menuType">
              <option value="combo">Menú de combos (sopa, proteína, principio, bebida)</option>
              <option value="catalog">Catálogo libre (productos con precio individual)</option>
            </select>
          </label>
          <label className="text-sm font-medium text-stone-700">
            Nombre de cada pedido <span className="font-normal text-stone-400">(ej. almuerzo, pedido, caja, docena)</span>
            <input className="input mt-1" defaultValue={restaurant.orderUnitLabel} name="orderUnitLabel" placeholder="almuerzo" required />
          </label>
          {!isCatalog && (
            <label className="text-sm font-medium text-stone-700">
              Precio base
              <input className="input mt-1 text-base" defaultValue={restaurant.basePrice.toString()} min="0" name="basePrice" required step="1" type="number" />
            </label>
          )}
          <SubmitButton className="button-primary sm:col-span-2">Guardar configuración</SubmitButton>
        </FeedbackForm>
      </div>

      <div className="rounded-xl border border-stone-200 p-4">
        <h3 className="text-lg font-semibold">Domicilio y entrega</h3>
        <div className="mt-4">
          <DeliveryForm
            allowPickup={restaurant.allowPickup}
            deliveryFee={restaurant.deliveryFee ? Number(restaurant.deliveryFee.toString()) : null}
            deliveryMode={restaurant.deliveryMode}
            deliveryNote={restaurant.deliveryNote}
            restaurantId={restaurant.id}
            returnPath={returnPath}
          />
        </div>
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
        {isCatalog ? (
          <CatalogMenuEditor
            initialCategories={catalogCategories.map(c => ({
              id: c.id,
              name: c.name,
              items: c.items.map(i => ({ id: i.id, name: i.name, price: Number(i.price.toString()) })),
            }))}
            publishedToday={menuPublishedToday}
            restaurantId={restaurant.id}
            returnPath={returnPath}
          />
        ) : (
          <MenuEditor
            hasTemplate={hasTemplate}
            menuPublishedToday={menuPublishedToday}
            restaurantId={restaurant.id}
            returnPath={returnPath}
            values={{
              soups: menu?.soups.join("\n"),
              proteins: menu?.proteins.join("\n"),
              sides: menu?.sides.join("\n"),
              drinks: menu?.drinks.join("\n"),
            }}
          />
        )}
      </div>

      <div className="rounded-xl border border-stone-200 p-4">
        <h3 className="text-lg font-semibold">Imagen del menú para compartir</h3>
        <p className="mt-1 text-sm text-stone-500">
          Genera una imagen (1080×1350) con el menú de hoy para tus estados de WhatsApp.
        </p>
        <div className="mt-4">
          <ShareMenuImage hasTemplate={!!restaurant.menuTemplatePath} publishedToday={menuPublishedToday} slug={restaurantSlug} version={menuVersion} />
        </div>

        {/* Template selector — 4 thumbnails (latest uploads first, then presets) */}
        <div className="mt-4 border-t border-stone-100 pt-4">
          <p className="text-sm font-medium text-stone-700">Fondo de la imagen <span className="font-normal text-stone-400">(elige una)</span></p>
          <div className="mt-2 flex flex-wrap gap-2">
            {templateSlots.map((path) => {
              const active = path === restaurant.menuTemplatePath;
              return (
                <FeedbackForm action={selectMenuTemplate} key={path}>
                  <input name="restaurantId" type="hidden" value={restaurant.id} />
                  <input name="returnPath" type="hidden" value={returnPath} />
                  <input name="templatePath" type="hidden" value={path} />
                  <button
                    aria-label={active ? "Plantilla activa" : "Usar esta plantilla"}
                    className={`relative block overflow-hidden rounded-lg border-2 transition ${active ? "border-brand-blue ring-2 ring-brand-blue/30" : "border-stone-200 hover:border-brand-blue/40"}`}
                    type="submit"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="Plantilla" className="h-24 w-[68px] object-cover" src={resolveFileUrl(path) ?? ""} />
                    {active && <span className="absolute inset-x-0 bottom-0 bg-brand-blue py-0.5 text-center text-[10px] font-semibold text-white">Activa</span>}
                  </button>
                </FeedbackForm>
              );
            })}
          </div>
          {restaurant.menuTemplateHistory.length > 0 && (
            <FeedbackForm action={resetMenuTemplates} className="mt-2">
              <input name="restaurantId" type="hidden" value={restaurant.id} />
              <input name="returnPath" type="hidden" value={returnPath} />
              <SubmitButton className="text-sm font-medium text-brand-purple hover:underline" pendingLabel="Restaurando…">
                ↺ Restaurar plantillas predeterminadas
              </SubmitButton>
            </FeedbackForm>
          )}
        </div>

        <FeedbackForm action={updateMenuTemplate} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input name="restaurantId" type="hidden" value={restaurant.id} />
          <input name="returnPath" type="hidden" value={returnPath} />
          <label className="text-sm font-medium text-stone-700">
            Subir tu propia plantilla <span className="font-normal text-stone-400">(PNG/JPG/WEBP. Recomendado 1080×1350 vertical; otras medidas se recortan. Deja libre el centro para el texto)</span>
            <FileInput accept="image/jpeg,image/png,image/webp" className="input mt-1" name="menuTemplate" required type="file" />
          </label>
          <SubmitButton className="button-primary self-end" pendingLabel="Subiendo…">Subir plantilla</SubmitButton>
        </FeedbackForm>
      </div>

      <div className="rounded-xl border border-stone-200 p-4">
        <h3 className="text-lg font-semibold">Medios de pago</h3>
        <p className="mt-1 text-sm text-stone-500">Datos que verá el cliente para pagar y subir su comprobante.</p>

        {/* Nequi principal (con QR) */}
        <FeedbackForm action={updatePaymentSettings} className="mt-4 grid gap-3 sm:grid-cols-2">
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
            <FileInput accept="image/jpeg,image/png,image/webp" className="input mt-1" name="nequiQr" type="file" />
          </label>
          {restaurant.nequiQrPath && (
            <div className="flex items-center gap-3 sm:col-span-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="QR de Nequi configurado" className="h-28 w-28 rounded-lg border border-stone-200 object-contain" src={resolveFileUrl(restaurant.nequiQrPath) ?? ""} />
              <p className="text-sm text-teal-600">QR configurado actualmente. Sube otro para reemplazarlo.</p>
            </div>
          )}
          <SubmitButton className="button-primary sm:col-span-2">Guardar Nequi</SubmitButton>
        </FeedbackForm>

        {/* Otros medios de pago */}
        <div className="mt-6 border-t border-stone-100 pt-4">
          <p className="text-sm font-semibold text-stone-700">
            Otros medios <span className="font-normal text-stone-400">(Daviplata, segunda llave, cuenta bancaria…)</span>
          </p>

          {restaurant.paymentMethods.length > 0 && (
            <ul className="mt-3 space-y-2">
              {restaurant.paymentMethods.map((m) => (
                <li className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3" key={m.id}>
                  <div className="flex min-w-0 items-center gap-3">
                    {m.qrPath && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt={`QR ${m.label}`} className="h-14 w-14 shrink-0 rounded-lg border border-stone-200 object-contain" src={resolveFileUrl(m.qrPath) ?? ""} />
                    )}
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold">{m.label}{m.accountType ? ` · cuenta ${m.accountType}` : ""}</p>
                      <p className="truncate text-stone-600">{m.phone} · {m.accountName}{m.idNumber ? ` · C.C. ${m.idNumber}` : ""}</p>
                    </div>
                  </div>
                  <FeedbackForm action={deletePaymentMethod}>
                    <input name="id" type="hidden" value={m.id} />
                    <input name="restaurantId" type="hidden" value={restaurant.id} />
                    <input name="returnPath" type="hidden" value={returnPath} />
                    <SubmitButton className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50" pendingLabel="Eliminando…">
                      Eliminar
                    </SubmitButton>
                  </FeedbackForm>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4">
            <PaymentMethodForm restaurantId={restaurant.id} returnPath={returnPath} />
          </div>
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
            <FeedbackForm action={setRestaurantPassword} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input name="restaurantId" type="hidden" value={restaurant.id} />
              <label className="text-sm font-medium text-stone-700">
                Nueva contraseña <span className="font-normal text-stone-400">(mínimo 8 caracteres)</span>
                <input className="input mt-1" minLength={8} name="password" placeholder="Nueva contraseña" required type="password" />
              </label>
              <SubmitButton className="button-primary self-end">
                {restaurant.passwordHash ? "Cambiar contraseña" : "Establecer contraseña"}
              </SubmitButton>
            </FeedbackForm>
            {!restaurant.passwordHash && (
              <p className="mt-2 text-sm text-amber-800">⚠ Este restaurante aún no tiene contraseña. El agente no podrá iniciar sesión hasta que la establezcas.</p>
            )}
          </details>
        </div>
      )}
    </div>
  );
}
