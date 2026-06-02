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
    const timer = setInterval(() => {
      router.refresh();
      setCount((c) => c + 1);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs, active]);

  if (!active) return null;

  return (
    <p className="mt-2 text-xs text-stone-400">
      Actualizando automáticamente cada {Math.round(intervalMs / 1000)} segundos
      {count > 0 && ` · última actualización hace un momento`}
    </p>
  );
}
