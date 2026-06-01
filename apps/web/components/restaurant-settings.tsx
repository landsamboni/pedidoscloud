import { updateBasePrice, updatePaymentSettings, updateTodayMenu } from "@/app/actions";

type Menu = {
  soups: string[];
  proteins: string[];
  sides: string[];
  drinks: string[];
} | undefined;

type Restaurant = {
  id: string;
  basePrice: { toString(): string };
  nequiPhone: string | null;
  nequiAccountName: string | null;
  nequiQrPath: string | null;
};

export function RestaurantSettings({ menu, restaurant, returnPath }: { menu: Menu; restaurant: Restaurant; returnPath: string }) {
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

      <details className="rounded-xl border border-stone-200 p-4">
        <summary className="cursor-pointer text-lg font-semibold">Editar menú de hoy</summary>
        <form action={updateTodayMenu} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input name="restaurantId" type="hidden" value={restaurant.id} />
          <input name="returnPath" type="hidden" value={returnPath} />
          <MenuTextarea label="Sopas" name="soups" options={menu?.soups} />
          <MenuTextarea label="Proteínas" name="proteins" options={menu?.proteins} />
          <MenuTextarea label="Principios" name="sides" options={menu?.sides} />
          <MenuTextarea label="Bebidas" name="drinks" options={menu?.drinks} />
          <button className="button-primary sm:col-span-2">Guardar menú</button>
        </form>
      </details>

      <details className="rounded-xl border border-stone-200 p-4">
        <summary className="cursor-pointer text-lg font-semibold">Configurar pagos Nequi</summary>
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
            QR Nequi <span className="font-normal text-stone-400">(opcional, deja vacío para conservar el actual)</span>
            <input accept="image/jpeg,image/png,image/webp" className="input mt-1" name="nequiQr" type="file" />
          </label>
          {restaurant.nequiQrPath && <p className="text-sm text-emerald-700 sm:col-span-2">QR configurado actualmente.</p>}
          <button className="button-primary sm:col-span-2">Guardar datos de pago</button>
        </form>
      </details>
    </div>
  );
}

function MenuTextarea({ label, name, options = [] }: { label: string; name: string; options?: string[] }) {
  return (
    <label className="text-sm font-medium text-stone-700">
      {label} <span className="font-normal text-stone-400">(una opción por línea)</span>
      <textarea className="input mt-1 min-h-28" defaultValue={options.join("\n")} name={name} required />
    </label>
  );
}
