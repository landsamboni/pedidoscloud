"use client";

import { deleteCustomer } from "@/app/actions";

/**
 * Delete-customer form with a confirm dialog. This lives in a Client Component
 * because onSubmit handlers can't be passed from a Server Component (which is
 * what broke the customers page when it had any customers).
 */
export function DeleteCustomerForm({
  customerId,
  restaurantSlug,
  name,
  orderCount,
}: {
  customerId: string;
  restaurantSlug: string;
  name: string;
  orderCount: number;
}) {
  return (
    <form
      action={deleteCustomer}
      onSubmit={(e) => {
        const msg = `¿Eliminar a "${name}"? ${orderCount > 0 ? `Sus ${orderCount} pedido(s) también serán eliminados.` : ""} No se puede deshacer.`;
        if (!confirm(msg)) e.preventDefault();
      }}
    >
      <input name="customerId" type="hidden" value={customerId} />
      <input name="restaurantSlug" type="hidden" value={restaurantSlug} />
      <button
        className="rounded-xl border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
        type="submit"
      >
        {orderCount > 0 ? `Eliminar cliente y sus ${orderCount} pedido(s)` : "Eliminar cliente"}
      </button>
    </form>
  );
}
