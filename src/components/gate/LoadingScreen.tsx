"use client";

import { LabLogoMark } from "@/components/brand/LabLogoMark";
import type { ModelLoadProgress } from "@/lib/anomaly-api";
import { cn } from "@/lib/utils";

export type ApiGateState = "loading" | "ready" | "error";

interface LoadingScreenProps {
  state: ApiGateState;
  progress: ModelLoadProgress;
  errorMessage?: string | null;
  onRetry?: () => void;
}

const STAGE_MESSAGE: Record<ModelLoadProgress["stage"], string> = {
  runtime: "Starting inference runtime...",
  weights: "Downloading model weights...",
  profile: "Loading category error profile...",
  warmup: "Warming up the autoencoder...",
  ready: "✓ Model ready. Loading dashboard...",
};

export function LoadingScreen({ state, progress, errorMessage, onRetry }: LoadingScreenProps) {
  const percent = Math.round(progress.ratio * 100);
  const message =
    state === "error"
      ? (errorMessage ?? "Could not load the model.")
      : STAGE_MESSAGE[progress.stage];

  return (
    <div className="api-gate-screen" role="status" aria-live="polite" aria-busy={state === "loading"}>
      <div className="api-gate-screen__logo-block">
        <LabLogoMark size={24} className="api-gate-screen__logo" />
        <p className="api-gate-screen__title">COMPARISON LAB</p>
      </div>

      {state === "loading" && <span className="api-gate-screen__spinner" aria-hidden />}

      <p
        className={cn(
          "api-gate-screen__status",
          state === "ready" && "api-gate-screen__status--ready",
          state === "error" && "api-gate-screen__status--error",
        )}
      >
        {message}
      </p>

      {state !== "error" && (
        <div
          className="api-gate-screen__progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <span className="api-gate-screen__progress-bar" style={{ width: `${percent}%` }} />
        </div>
      )}

      {state === "loading" && (
        <p className="api-gate-screen__attempts">
          {percent}% — runs locally, no server inference
        </p>
      )}

      {state === "error" && onRetry && (
        <button type="button" className="api-gate-screen__retry" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
