"use client";

import { useEffect, useRef } from "react";

/**
 * Textarea that grows to fit its content so the whole text is always visible —
 * no internal scrollbar. This avoids the mobile "scroll trap" where dragging
 * inside a short, overflowing textarea scrolls the box instead of the page.
 * Still submits normally inside a <form> (forwards name/defaultValue/required).
 */
export function AutoGrowTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function resize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  // Fit to the initial (server-rendered) value after hydration.
  useEffect(() => {
    if (ref.current) resize(ref.current);
  }, []);

  return (
    <textarea
      ref={ref}
      onInput={(e) => resize(e.currentTarget)}
      {...props}
    />
  );
}
