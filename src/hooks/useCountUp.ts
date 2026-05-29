"use client";

import { useEffect, useRef, useState } from "react";

export interface UseCountUpOptions {
  duration?: number;
  decimals?: number;
  suffix?: string;
  fallback?: string;
}

export function useCountUp(
  value: number | null | undefined,
  options: UseCountUpOptions = {},
): string {
  const { duration = 600, decimals, suffix = "", fallback = "—" } = options;
  const [display, setDisplay] = useState(fallback);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
    }

    if (value == null || !Number.isFinite(value)) {
      setDisplay(fallback);
      return;
    }

    const targetValue = value;
    const isFloat = !Number.isInteger(targetValue);
    const resolvedDecimals =
      decimals ?? (isFloat ? (String(targetValue).split(".")[1] || "").length : 0);
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = targetValue * eased;
      setDisplay(`${current.toFixed(resolvedDecimals)}${suffix}`);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [value, duration, decimals, suffix, fallback]);

  return display;
}
