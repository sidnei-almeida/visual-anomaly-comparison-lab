"use client";

import { LabLogoMark } from "@/components/brand/LabLogoMark";
import { cn } from "@/lib/utils";

export type ApiGateState = "checking" | "waiting" | "ready";

interface LoadingScreenProps {
  state: ApiGateState;
  attempts: number;
}

function statusMessage(state: ApiGateState, attempts: number): string {
  if (state === "ready") {
    return "✓ API ready. Loading dashboard...";
  }

  if (state === "waiting") {
    if (attempts > 3) {
      return "Still waking up, this may take up to 30 seconds...";
    }
    return "API is waking up, please wait...";
  }

  return "Connecting to API...";
}

export function LoadingScreen({ state, attempts }: LoadingScreenProps) {
  const message = statusMessage(state, attempts);

  return (
    <div className="api-gate-screen" role="status" aria-live="polite" aria-busy={state !== "ready"}>
      <div className="api-gate-screen__logo-block">
        <LabLogoMark size={24} className="api-gate-screen__logo" />
        <p className="api-gate-screen__title">COMPARISON LAB</p>
      </div>

      <span className="api-gate-screen__spinner" aria-hidden />

      <p className={cn("api-gate-screen__status", state === "ready" && "api-gate-screen__status--ready")}>
        {message}
      </p>

      {attempts > 1 && (
        <p className="api-gate-screen__attempts">attempt {attempts}</p>
      )}
    </div>
  );
}
