"use client";

import { useEffect, useRef, useState } from "react";
import { LoadingScreen, type ApiGateState } from "@/components/gate/LoadingScreen";
import {
  HEALTH_CHECK_POLL_MS,
  HEALTH_CHECK_READY_GRACE_MS,
  HEALTH_CHECK_TIMEOUT_MS,
  HEALTH_CHECK_URL,
} from "@/config/health-check";
import { cn } from "@/lib/utils";

export type { ApiGateState };

async function fetchHealthOk(signal: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(HEALTH_CHECK_URL, {
      method: "GET",
      signal,
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function ApiGate({ children }: { children: React.ReactNode }) {
  const [gateState, setGateState] = useState<ApiGateState>("checking");
  const [attempts, setAttempts] = useState(0);
  const [showDashboard, setShowDashboard] = useState(false);

  const gateStateRef = useRef(gateState);
  const showDashboardRef = useRef(showDashboard);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const attemptRef = useRef(0);

  gateStateRef.current = gateState;
  showDashboardRef.current = showDashboard;

  useEffect(() => {
    let cancelled = false;

    const clearRetryTimer = () => {
      if (retryTimerRef.current != null) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const scheduleRetry = (runCheck: () => void) => {
      clearRetryTimer();
      if (document.visibilityState === "hidden") return;
      retryTimerRef.current = setTimeout(runCheck, HEALTH_CHECK_POLL_MS);
    };

    const runCheck = async () => {
      if (cancelled || showDashboardRef.current || document.visibilityState === "hidden") {
        return;
      }

      requestAbortRef.current?.abort();
      const controller = new AbortController();
      requestAbortRef.current = controller;

      const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

      setGateState((prev) => (prev === "ready" ? "ready" : "checking"));

      attemptRef.current += 1;
      const attemptNumber = attemptRef.current;
      setAttempts(attemptNumber);

      let ok = false;
      try {
        ok = await fetchHealthOk(controller.signal);
      } catch {
        ok = false;
      } finally {
        clearTimeout(timeoutId);
      }

      if (cancelled || showDashboardRef.current) return;

      if (ok) {
        setGateState("ready");
        readyTimerRef.current = setTimeout(() => {
          if (!cancelled) {
            setShowDashboard(true);
          }
        }, HEALTH_CHECK_READY_GRACE_MS);
        return;
      }

      setGateState("waiting");
      scheduleRetry(() => {
        void runCheck();
      });
    };

    void runCheck();

    const onVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        !showDashboardRef.current &&
        gateStateRef.current !== "ready"
      ) {
        clearRetryTimer();
        void runCheck();
      }

      if (document.visibilityState === "hidden") {
        requestAbortRef.current?.abort();
        clearRetryTimer();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      requestAbortRef.current?.abort();
      clearRetryTimer();
      if (readyTimerRef.current != null) {
        clearTimeout(readyTimerRef.current);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <>
      {!showDashboard && <LoadingScreen state={gateState} attempts={attempts} />}
      {showDashboard && (
        <div className={cn("app-wrapper", "app-wrapper--visible")}>{children}</div>
      )}
    </>
  );
}
