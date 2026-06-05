import { deletePaymentMethod, resetMenuTemplates, selectMenuTemplate, setRestaurantPassword, updateBasePrice, updateMenuTemplate, updateMenuType, updatePaymentSettings } from "@/app/actions";
import { FeedbackForm, FileInput, SubmitButton } from "@/components/feedback-form";
import { CatalogMenuEditor } from "@/components/catalog-menu-editor";
import { DeliveryForm } from "@/components/delivery-form";
import { MenuTypeForm } from "@/components/menu-type-form";
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
      {/* Only platform admin can change the business type — not the restaurant operator. */}
      {!hidePassword && (
        <div className="rounded-xl border border-stone-200 p-4">
          <h3 className="text-lg font-semibold">Tipo de negocio</h3>
          <MenuTypeForm
            basePrice={restaurant.basePrice.toString()}
            menuType={restaurant.menuType}
            orderUnitLabel={restaurant.orderUnitLabel}
            restaurantId={restaurant.id}
            returnPath={returnPath}
          />
        </div>
      )}

      {/* Base price — only for restaurant operator in combo mode (admin manages it via MenuTypeForm) */}
      {hidePassword && !isCatalog && (
        <div className="rounded-xl border border-stone-200 p-4">
          <h3 className="text-lg font-semibold">Precio del almuerzo</h3>
          <FeedbackForm action={updateBasePrice} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <input name="restaurantId" type="hidden" value={restaurant.id} />
            <input name="returnPath" type="hidden" value={returnPath} />
            <label className="text-sm font-medium text-stone-700">
              Precio base de cada almuerzo
              <input className="input mt-1 text-base" defaultValue={restaurant.basePrice.toString()} min="1" name="basePrice" required step="1" type="number" />
            </label>
            <SubmitButton className="button-primary self-end">Guardar precio</SubmitButton>
          </FeedbackForm>
        </div>
      )}

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
