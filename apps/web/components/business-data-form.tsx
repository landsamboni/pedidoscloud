import { resetLogo, updateBusinessPhone, updateLogo } from "@/app/actions";
import { FeedbackForm, FileInput, SubmitButton } from "@/components/feedback-form";
import { resolveFileUrl } from "@/lib/file-url";
import { DEFAULT_LOGO_PATH } from "@/lib/branding";

/**
 * Permanent business data (phone/WhatsApp + logo). Rendered as its own top-level
 * card, separate from the daily "Configuración" settings.
 */
export function BusinessDataForm({
  restaurantId,
  whatsappPhone,
  logoPath,
  returnPath,
}: {
  restaurantId: string;
  whatsappPhone: string | null;
  logoPath: string | null;
  returnPath: string;
}) {
  return (
    <section className="card mt-4">
      <h2 className="text-xl font-bold">Datos del negocio</h2>

      <FeedbackForm action={updateBusinessPhone} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input name="restaurantId" type="hidden" value={restaurantId} />
        <input name="returnPath" type="hidden" value={returnPath} />
        <label className="text-sm font-medium text-stone-700">
          Teléfono / WhatsApp <span className="font-normal text-stone-400">(el mismo número; lo usa el botón &quot;Preguntar por WhatsApp&quot; del cliente y el banner de la imagen)</span>
          <input className="input mt-1 text-base" defaultValue={whatsappPhone ?? ""} inputMode="tel" maxLength={10} name="whatsappPhone" placeholder="3001234567" />
        </label>
        <SubmitButton className="button-primary self-end">Guardar número</SubmitButton>
      </FeedbackForm>

      <FeedbackForm action={updateLogo} className="mt-4 grid gap-3 border-t border-stone-100 pt-4 sm:grid-cols-[1fr_auto]">
        <input name="restaurantId" type="hidden" value={restaurantId} />
        <input name="returnPath" type="hidden" value={returnPath} />
        <label className="text-sm font-medium text-stone-700">
          Logo del negocio <span className="font-normal text-stone-400">(PNG/JPG/WEBP. Recomendado cuadrado, mínimo 512×512 px; PNG con fondo transparente se ve mejor. Aparece en la página del cliente y en la imagen del menú)</span>
          <FileInput accept="image/jpeg,image/png,image/webp" className="input mt-1" name="logo" required type="file" />
        </label>
        <SubmitButton className="button-primary self-end" pendingLabel="Subiendo…">{logoPath ? "Cambiar logo" : "Subir logo"}</SubmitButton>
        <div className="flex items-center gap-3 sm:col-span-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="Logo del negocio" className="h-20 w-20 rounded-lg border border-stone-200 bg-white object-contain p-1" src={resolveFileUrl(logoPath) ?? DEFAULT_LOGO_PATH} />
          <p className="text-sm text-stone-500">{logoPath ? "Logo propio configurado." : "Usando el logo por defecto. Sube el tuyo para reemplazarlo."}</p>
        </div>
      </FeedbackForm>

      {logoPath && (
        <FeedbackForm action={resetLogo} className="mt-2">
          <input name="restaurantId" type="hidden" value={restaurantId} />
          <input name="returnPath" type="hidden" value={returnPath} />
          <SubmitButton className="text-sm font-medium text-brand-pink hover:underline" pendingLabel="Restaurando…">
            ↺ Restaurar logo por defecto
          </SubmitButton>
        </FeedbackForm>
      )}
    </section>
  );
}
