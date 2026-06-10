"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface AutoRefreshProps {
  intervalMs?: number;
  active?: boolean;
}

export function AutoRefresh({ intervalMs = 20000, active = true }: AutoRefreshProps) {
  const router = useRouter();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active) return;
    // Skip refreshes while the tab is hidden to avoid needless load at scale.
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setCount((c) => c + 1);
    }, intervalMs);
    const onVisible = () => { if (document.visibilityState === "visible") router.refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [router, intervalMs, active]);

  if (!active) return null;

  return (
    <p className="mt-2 text-xs text-stone-400">
      Actualizando automáticamente cada {Math.round(intervalMs / 1000)} segundos
      {count > 0 && ` · última actualización hace un momento`}
    </p>
  );
}
