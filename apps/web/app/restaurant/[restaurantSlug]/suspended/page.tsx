import { logoutAction } from "@/app/login/actions";

export default async function SuspendedPage({ params }: { params: Promise<{ restaurantSlug: string }> }) {
  const { restaurantSlug } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 p-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-4xl">
          🔒
        </div>

        <h1 className="text-2xl font-bold text-stone-900">Suscripción vencida</h1>
        <p className="mt-3 text-base leading-relaxed text-stone-600">
          Tu período de suscripción ha terminado. Para reactivar el acceso, comunícate con el administrador de la plataforma y realiza el pago de renovación.
        </p>

        <div className="mt-6 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800">
          <p className="font-semibold">¿Ya realizaste el pago?</p>
          <p className="mt-1">
            Espera a que el administrador confirme tu pago y reactive tu cuenta. Una vez activada, cierra sesión y vuelve a ingresar.
          </p>
        </div>

        <form action={logoutAction} className="mt-6">
          <button className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100" type="submit">
            Cerrar sesión
          </button>
        </form>

        <p className="mt-4 text-xs text-stone-400">Restaurante: {restaurantSlug}</p>
      </div>
    </main>
  );
}
