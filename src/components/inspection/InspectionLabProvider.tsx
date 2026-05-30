"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Topbar } from "@/components/layout/Topbar";
import { SampleNavigator } from "@/components/inspection/SampleNavigator";
import { ComparisonLab } from "@/components/viewer/ComparisonLab";
import { InferenceSummary } from "@/components/results/InferenceSummary";
import { InspectionCharts } from "@/components/dashboard/InspectionCharts";
import { SidebarBatchActions } from "@/components/timeline/SidebarBatchActions";
import {
  bootstrapLab,
  inspectSampleWithFallback,
  inspectSamplesBatch,
  inspectUploadRemote,
  isApiLoading,
  isApiReady,
  resultToTimelineEntry,
} from "@/services/inspectionService";
import { isSampleApiSupported } from "@/config/api-categories";
import type { InspectionSample } from "@/types/inspection";
import { api } from "@/services/api";
import {
  ensureDefaultSampleSelection,
  getPendingSamples,
  useInspectionStore,
} from "@/store/inspection-store";

const LINE_GAP_MS = 400;
const HEALTH_POLL_MS = 12_000;
const DEMO_FALLBACK_ENABLED = process.env.NEXT_PUBLIC_ALLOW_DEMO_FALLBACK === "true";

export function InspectionLabProvider({ children }: { children?: React.ReactNode }) {
  const lineAbortRef = useRef<AbortController | null>(null);
  const inspectAbortRef = useRef<AbortController | null>(null);
  const initStartedRef = useRef(false);
  const wasInspectingRef = useRef(false);
  const [showAnalysisComplete, setShowAnalysisComplete] = useState(false);

  const runInspection = useCallback(
    async (
      sampleId: string,
      options: { silent?: boolean; force?: boolean; reprocess?: boolean } = {},
    ) => {
      const state = useInspectionStore.getState();
      const sample = state.samples.find((s) => s.id === sampleId);
      const metadata = state.modelMetadata;
      const health = state.apiHealth;

      if (!sample || !metadata) return;

      if (!options.silent) {
        useInspectionStore.getState().selectSample(sampleId);
      }

      if (!options.force && !options.reprocess && state.resultsBySampleId[sampleId]) {
        return;
      }

      const manualCategory =
        sample.source === "upload" ? useInspectionStore.getState().selectedApiCategory : null;
      const sampleUnsupported = sample.source !== "upload" && !isSampleApiSupported(sample);

      if (!options.force && !sampleUnsupported && !isApiReady(health)) {
        const message = isApiLoading(health)
          ? "Model is loading, try again in a few seconds."
          : health?.message ?? "API unavailable.";
        if (!options.silent) useInspectionStore.getState().setError(message);
        return;
      }

      if (
        !options.force &&
        !sampleUnsupported &&
        state.sessionContainsDemoData &&
        !options.reprocess &&
        isApiReady(health) &&
        !DEMO_FALLBACK_ENABLED
      ) {
        if (!options.silent) {
          useInspectionStore.getState().setError(
            "Session contains demo data from a previous fallback. Reset the session before running real inference.",
          );
        }
        return;
      }

      inspectAbortRef.current?.abort();
      const controller = new AbortController();
      inspectAbortRef.current = controller;

      useInspectionStore.getState().setInspecting(true);
      if (!options.silent) useInspectionStore.getState().setError(null);

      try {
        const result = await inspectSampleWithFallback(
          sample,
          metadata,
          manualCategory,
          controller.signal,
        );
        const sequenceNumber = useInspectionStore.getState().nextSequenceNumber();
        useInspectionStore.getState().recordInspectionRun(result, sample, sequenceNumber, {
          isReprocess: Boolean(options.reprocess),
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Inspection failed";
        useInspectionStore.getState().setError(message);
      } finally {
        if (!controller.signal.aborted) {
          useInspectionStore.getState().setInspecting(false);
        }
      }
    },
    [],
  );

  const handleSelectSample = useCallback(
    async (sampleId: string) => {
      useInspectionStore.getState().selectSample(sampleId);
      await runInspection(sampleId);
    },
    [runInspection],
  );

  const handleReprocessSample = useCallback(
    async (sampleId: string) => {
      useInspectionStore.getState().selectSample(sampleId);
      await runInspection(sampleId, { reprocess: true, force: true });
    },
    [runInspection],
  );

  const stopLine = useCallback(() => {
    lineAbortRef.current?.abort();
    lineAbortRef.current = null;
    useInspectionStore.getState().setLineRunning(false);
  }, []);

  const handleUploadFiles = useCallback(async (files: FileList) => {
    const metadata = useInspectionStore.getState().modelMetadata;
    const health = useInspectionStore.getState().apiHealth;
    if (!metadata || !isApiReady(health)) {
      useInspectionStore.getState().setError(
        isApiLoading(health)
          ? "Model is loading, try again in a few seconds."
          : health?.message ?? "API unavailable.",
      );
      return;
    }

    const preservedSelection = useInspectionStore.getState().selectedSampleId;

    const uploadedSamples: InspectionSample[] = Array.from(files).map((file, index) => ({
      id: `upload-${Date.now()}-${index}-${file.name}`,
      name: file.name,
      filename: file.name,
      imageUrl: URL.createObjectURL(file),
      source: "upload" as const,
      label: "unknown" as const,
    }));

    const existing = useInspectionStore.getState().samples;
    useInspectionStore.getState().setSamples([...existing, ...uploadedSamples]);

    useInspectionStore.getState().setInspecting(true);
    useInspectionStore.getState().setError(null);

    const failures: Array<{ sampleId: string; fileName: string; message: string }> = [];
    const results = [];
    const timelineEntries = [];
    let sequenceNumber = useInspectionStore.getState().sequenceCounter;

    for (let index = 0; index < uploadedSamples.length; index += 1) {
      const sample = uploadedSamples[index];
      const file = files[index];
      try {
        const manualCategory = useInspectionStore.getState().selectedApiCategory;
        const result = await inspectUploadRemote(file, sample, metadata, manualCategory);
        sequenceNumber += 1;
        results.push(result);
        timelineEntries.push(resultToTimelineEntry(result, sequenceNumber, sample));
      } catch (error) {
        failures.push({
          sampleId: sample.id,
          fileName: sample.filename,
          message: error instanceof Error ? error.message : "Inspection failed",
        });
      }
    }

    if (results.length > 0) {
      useInspectionStore.getState().appendBatchOutcome({ results, timelineEntries, failures });
      if (preservedSelection) {
        useInspectionStore.getState().selectSample(preservedSelection);
      }
    } else if (failures.length > 0) {
      useInspectionStore.setState((state) => ({
        batchFailures: [...state.batchFailures, ...failures],
      }));
      useInspectionStore.getState().setError(failures[0].message);
    }

    if (failures.length > 0 && results.length > 0) {
      useInspectionStore.getState().setError(
        `${failures.length} upload(s) failed. ${results.length} succeeded.`,
      );
    }

    useInspectionStore.getState().setInspecting(false);
  }, []);

  const runBatch = useCallback(async (reprocessAll: boolean) => {
    if (useInspectionStore.getState().isLineRunning) return;

    const health = useInspectionStore.getState().apiHealth;
    if (!isApiReady(health)) {
      useInspectionStore.getState().setError(
        isApiLoading(health)
          ? "Model is loading, try again in a few seconds."
          : health?.message ?? "API unavailable.",
      );
      return;
    }

    const list = useInspectionStore.getState().samples;
    const cached = useInspectionStore.getState().resultsBySampleId;
    const pending = getPendingSamples(list, cached);
    const targets = reprocessAll ? list : pending;

    if (!reprocessAll && targets.length === 0) {
      useInspectionStore.getState().setError(
        "All samples are already inspected. Use “Reprocess all” to run them again.",
      );
      return;
    }

    const preservedSelection = useInspectionStore.getState().selectedSampleId;

    const controller = new AbortController();
    lineAbortRef.current = controller;
    useInspectionStore.getState().setLineRunning(true);
    useInspectionStore.getState().setError(null);

    const metadata = useInspectionStore.getState().modelMetadata;
    if (!metadata) {
      useInspectionStore.getState().setLineRunning(false);
      return;
    }

    try {
      const startingSequence = useInspectionStore.getState().sequenceCounter;
      const manualCategory = useInspectionStore.getState().selectedApiCategory;
      const outcome = await inspectSamplesBatch(targets, metadata, manualCategory, {
        signal: controller.signal,
        allowDemoFallback: DEMO_FALLBACK_ENABLED,
        gapMs: LINE_GAP_MS,
        startingSequenceNumber: startingSequence,
      });

      if (controller.signal.aborted) return;

      useInspectionStore.getState().appendBatchOutcome({
        results: outcome.results,
        timelineEntries: outcome.timelineEntries,
        failures: outcome.failures,
        isReprocess: reprocessAll,
      });

      if (preservedSelection) {
        useInspectionStore.getState().selectSample(preservedSelection);
      }

      if (outcome.failures.length > 0) {
        useInspectionStore.getState().setError(
          `${outcome.failures.length} image(s) failed inference. ${outcome.results.length} succeeded.`,
        );
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        useInspectionStore.getState().setError(
          error instanceof Error ? error.message : "Batch inspection failed",
        );
      }
    } finally {
      useInspectionStore.getState().setLineRunning(false);
    }
  }, []);

  // Bootstrap once on mount — must NOT depend on handleSelectSample / runInspection.
  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    const controller = new AbortController();

    (async () => {
      try {
        const boot = await bootstrapLab(controller.signal);
        const store = useInspectionStore.getState();

        store.setSamples(boot.samples);
        store.setApiHealth(boot.health);
        store.setModelMetadata(boot.metadata);

        if (!boot.health.apiReachable) {
          store.setError(boot.health.message ?? "API unreachable");
        } else if (isApiLoading(boot.health)) {
          store.setError("Model is loading, try again in a few seconds.");
        } else {
          store.setError(null);
        }

        const defaultId = ensureDefaultSampleSelection(boot.samples, store.selectedSampleId);
        if (defaultId) {
          store.selectSample(defaultId);
          if (isApiReady(boot.health) && !store.resultsBySampleId[defaultId]) {
            const sample = boot.samples.find((s) => s.id === defaultId);
            if (sample && store.modelMetadata) {
              store.setInspecting(true);
              try {
                const manualCategory =
                  sample.source === "upload" ? store.selectedApiCategory : null;
                const result = await inspectSampleWithFallback(
                  sample,
                  store.modelMetadata,
                  manualCategory,
                  controller.signal,
                );
                const sequenceNumber = store.nextSequenceNumber();
                store.recordInspectionRun(result, sample, sequenceNumber);
              } catch {
                /* initial auto-infer is best-effort */
              } finally {
                store.setInspecting(false);
              }
            }
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          useInspectionStore
            .getState()
            .setError(error instanceof Error ? error.message : "Failed to initialize lab");
        }
      } finally {
        useInspectionStore.getState().setInitializing(false);
      }
    })();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap runs once; initStartedRef guards remounts
  }, []);

  // Health poll — independent from bootstrap / selection.
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const health = await api.getHealth();
        const prev = useInspectionStore.getState().apiHealth;
        useInspectionStore.getState().setApiHealth(health);

        if (
          prev &&
          !isApiReady(prev) &&
          isApiReady(health) &&
          useInspectionStore.getState().sessionContainsDemoData
        ) {
          useInspectionStore.getState().markApiRecoveredAfterDemo();
        }
      } catch {
        /* ignore poll errors */
      }
    }, HEALTH_POLL_MS);

    return () => {
      clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    return () => {
      inspectAbortRef.current?.abort();
      stopLine();
    };
  }, [stopLine]);

  const isInitializing = useInspectionStore((s) => s.isInitializing);
  const isInspecting = useInspectionStore((s) => s.isInspecting);
  const error = useInspectionStore((s) => s.error);
  const currentResult = useInspectionStore((s) => s.currentResult);
  const showCharts = useInspectionStore((s) => s.showCharts);
  const inspectionHistory = useInspectionStore((s) => s.inspectionHistory);
  const sessionMetrics = useInspectionStore((s) => s.sessionMetrics);
  const timeline = useInspectionStore((s) => s.timeline);
  const apiHealth = useInspectionStore((s) => s.apiHealth);
  const demoFallbackEnvEnabled = useInspectionStore((s) => s.demoFallbackEnvEnabled);
  const sessionContainsDemoData = useInspectionStore((s) => s.sessionContainsDemoData);
  const apiRecoveredAfterDemo = useInspectionStore((s) => s.apiRecoveredAfterDemo);

  const sessionDate = currentResult
    ? format(new Date(currentResult.timestamp), "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");
  const sessionTime = currentResult
    ? format(new Date(currentResult.timestamp), "HH:mm:ss")
    : format(new Date(), "HH:mm:ss");

  useEffect(() => {
    if (wasInspectingRef.current && !isInspecting) {
      setShowAnalysisComplete(true);
      const timer = window.setTimeout(() => setShowAnalysisComplete(false), 2000);
      wasInspectingRef.current = false;
      return () => window.clearTimeout(timer);
    }
    wasInspectingRef.current = isInspecting;
    return undefined;
  }, [isInspecting]);

  if (isInitializing) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-lab-bg text-lab-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-lab-border border-t-lab-accent" />
        <p className="text-sm">Connecting to inspection API…</p>
      </div>
    );
  }

  return (
    <div className="app-layout flex h-screen flex-col overflow-hidden bg-lab-bg">
      <Topbar sessionDate={sessionDate} sessionTime={sessionTime} />

      {demoFallbackEnvEnabled && (
        <div className="lab-banner bg-[rgba(230,51,41,0.08)] text-lab-cream">
          Demo fallback active — failed inferences may use local synthetic data. Real and demo results
          are labeled separately.
        </div>
      )}

      {sessionContainsDemoData && !demoFallbackEnvEnabled && (
        <div className="lab-banner bg-[rgba(230,51,41,0.08)] text-lab-cream">
          This session contains demo fallback data. Reset before trusting live metrics.
          <button
            type="button"
            onClick={() => useInspectionStore.getState().resetSession()}
            className="ml-2 batch-btn"
          >
            Reset session
          </button>
        </div>
      )}

      {apiRecoveredAfterDemo && sessionContainsDemoData && (
        <div className="lab-banner bg-[var(--terra-bg)] text-lab-cream">
          API is back online, but this session still includes demo fallback results.
          <button
            type="button"
            onClick={() => useInspectionStore.getState().resetSession()}
            className="ml-2 batch-btn"
          >
            Reset session
          </button>
        </div>
      )}

      {isApiLoading(apiHealth) && (
        <div className="lab-banner bg-[var(--cream-06)] text-lab-muted">
          Model is loading, try again in a few seconds.
        </div>
      )}

      {error && (
        <div className="lab-banner bg-[rgba(230,51,41,0.08)] text-lab-anomaly">
          {error}
          {currentResult?.isDemoFallback && (
            <span className="ml-2 status-badge status-badge--anomaly">Demo fallback result</span>
          )}
        </div>
      )}

      {showAnalysisComplete && !isInspecting && (
        <div className="lab-banner lab-banner--complete">✓ Analysis complete</div>
      )}

      {isInspecting && (
        <div className="lab-banner lab-banner--analyzing">
          <span className="lab-spinner lab-spinner--sm" aria-hidden />
          Analyzing image with autoencoder…
        </div>
      )}

      <div className="main-content center-content flex min-h-0 flex-1">
        <SampleNavigator onSelectSample={handleSelectSample} onUploadFiles={handleUploadFiles} />
        {children ?? (
          <>
            <ComparisonLab />
            <InferenceSummary
              onReprocessSample={handleReprocessSample}
              onStartPending={() => runBatch(false)}
              onReprocessAll={() => runBatch(true)}
              onStopLine={stopLine}
            />
          </>
        )}
      </div>

      <footer className="bottom-action-bar">
        <SidebarBatchActions
          onStartPending={() => runBatch(false)}
          onReprocessAll={() => runBatch(true)}
          onStopLine={stopLine}
        />
      </footer>

      <InspectionCharts
        open={showCharts}
        onClose={() => useInspectionStore.getState().setShowCharts(false)}
        results={inspectionHistory}
        metrics={sessionMetrics}
        timelineLength={timeline.length}
      />
    </div>
  );
}

export function AppShell() {
  return <InspectionLabProvider />;
}
