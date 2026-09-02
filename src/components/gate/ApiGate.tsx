"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoadingScreen, type ApiGateState } from "@/components/gate/LoadingScreen";
import { GATE_READY_GRACE_MS } from "@/config/health-check";
import { preloadModel, type ModelLoadProgress } from "@/lib/anomaly-api";
import { cn } from "@/lib/utils";

export type { ApiGateState };

const INITIAL_PROGRESS: ModelLoadProgress = { ratio: 0, stage: "runtime" };

/** Downloads the ONNX model and holds the dashboard back until inference is possible. */
export function ApiGate({ children }: { children: React.ReactNode }) {
  const [gateState, setGateState] = useState<ApiGateState>("loading");
  const [progress, setProgress] = useState<ModelLoadProgress>(INITIAL_PROGRESS);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const cancelledRef = useRef(false);
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    cancelledRef.current = false;

    setGateState("loading");
    setErrorMessage(null);
    setProgress(INITIAL_PROGRESS);

    preloadModel((update) => {
      if (!cancelledRef.current) setProgress(update);
    })
      .then(() => {
        if (cancelledRef.current) return;
        setGateState("ready");
        readyTimerRef.current = setTimeout(() => {
          if (!cancelledRef.current) setShowDashboard(true);
        }, GATE_READY_GRACE_MS);
      })
      .catch((error: unknown) => {
        if (cancelledRef.current) return;
        setGateState("error");
        setErrorMessage(error instanceof Error ? error.message : "Could not load the model.");
      });

    return () => {
      cancelledRef.current = true;
      if (readyTimerRef.current != null) clearTimeout(readyTimerRef.current);
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return (
    <>
      {!showDashboard && (
        <LoadingScreen
          state={gateState}
          progress={progress}
          errorMessage={errorMessage}
          onRetry={retry}
        />
      )}
      {showDashboard && (
        <div className={cn("app-wrapper", "app-wrapper--visible")}>{children}</div>
      )}
    </>
  );
}
