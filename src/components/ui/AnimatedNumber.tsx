"use client";

import { useCountUp, type UseCountUpOptions } from "@/hooks/useCountUp";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps extends UseCountUpOptions {
  value: number | null | undefined;
  className?: string;
}

export function AnimatedNumber({ value, className, ...options }: AnimatedNumberProps) {
  const display = useCountUp(value, options);

  return <span className={cn(className)}>{display}</span>;
}
