"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toggleCustomerFavorite } from "@/app/actions";

export function FavoriteButton({
  customerId,
  favorite: initialFavorite,
  returnPath,
}: {
  customerId: string;
  favorite: boolean;
  returnPath: string;
}) {
  const [state, action, pending] = useActionState(toggleCustomerFavorite, { ok: false, message: "", ts: 0 });
  const [isFav, setIsFav] = useState(initialFavorite);
  const lastTs = useRef(0);

  // Optimistic update on click, revert will happen if needed via state
  useEffect(() => {
    if (state.ok && state.ts !== lastTs.current) {
      lastTs.current = state.ts;
    }
  }, [state]);

  return (
    <form
      action={action}
      onSubmit={() => setIsFav(f => !f)}
    >
      <input name="customerId" type="hidden" value={customerId} />
      <input name="returnPath" type="hidden" value={returnPath} />
      <button
        aria-label={isFav ? "Quitar de favoritos" : "Marcar como favorito"}
        className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold transition ${
          isFav
            ? "border-yellow-400 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
            : "border-stone-300 bg-white text-stone-500 hover:border-yellow-400 hover:text-yellow-600"
        }`}
        disabled={pending}
        type="submit"
      >
        <span>{isFav ? "⭐" : "☆"}</span>
        <span>{isFav ? "Favorito" : "Marcar favorito"}</span>
      </button>
    </form>
  );
}
