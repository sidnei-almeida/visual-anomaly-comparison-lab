import { create } from "zustand";
import {
  DEFAULT_API_CATEGORY,
  isSampleApiSupported,
  type ApiCategory,
} from "@/config/api-categories";
import type {
  ApiHealth,
  ApiMetadata,
  InspectionResult,
  InspectionSample,
  InspectionView,
  TimelineEntry,
} from "@/types/inspection";
import type { SessionMetrics } from "@/types/inference";
import { buildTimelineEntryFromResult, computeSessionMetrics } from "@/lib/inference-utils";

export interface RecordInspectionOptions {
  /** When true, always append a new timeline event (manual re-run or reprocess all). */
  isReprocess?: boolean;
}

interface InspectionState {
  samples: InspectionSample[];
  selectedSampleId: string | null;
  currentResult: InspectionResult | null;
  resultsBySampleId: Record<string, InspectionResult>;
  timeline: TimelineEntry[];
  inspectionHistory: InspectionResult[];
  batchFailures: Array<{ sampleId: string; fileName: string; message: string }>;
  sessionMetrics: SessionMetrics;
  apiHealth: ApiHealth | null;
  modelMetadata: ApiMetadata | null;
  isInitializing: boolean;
  isInspecting: boolean;
  isLineRunning: boolean;
  error: string | null;
  sequenceCounter: number;
  selectedView: InspectionView;
  selectedApiCategory: ApiCategory;
  showCharts: boolean;
  demoFallbackEnvEnabled: boolean;
  sessionContainsDemoData: boolean;
  apiRecoveredAfterDemo: boolean;

  setSamples: (samples: InspectionSample[]) => void;
  selectSample: (sampleId: string | null) => void;
  setCurrentResult: (result: InspectionResult | null) => void;
  recordInspectionRun: (
    result: InspectionResult,
    sample: InspectionSample,
    sequenceNumber: number,
    options?: RecordInspectionOptions,
  ) => void;
  appendBatchOutcome: (payload: {
    results: InspectionResult[];
    timelineEntries: TimelineEntry[];
    failures: Array<{ sampleId: string; fileName: string; message: string }>;
    isReprocess?: boolean;
  }) => void;
  setApiHealth: (health: ApiHealth | null) => void;
  setModelMetadata: (metadata: ApiMetadata | null) => void;
  setInitializing: (value: boolean) => void;
  setInspecting: (value: boolean) => void;
  setLineRunning: (value: boolean) => void;
  setError: (message: string | null) => void;
  nextSequenceNumber: () => number;
  setSelectedView: (view: InspectionView) => void;
  setSelectedApiCategory: (category: ApiCategory) => void;
  setShowCharts: (value: boolean) => void;
  markApiRecoveredAfterDemo: () => void;
  resetSession: () => void;
  resetInspection: () => void;
}

const EMPTY_METRICS: SessionMetrics = {
  totalProcessed: 0,
  normalCount: 0,
  anomalyCount: 0,
  anomalyRate: 0,
  avgAnomalyScore: null,
  maxAnomalyScore: null,
  minAnomalyScore: null,
  avgErrorMean: null,
  avgLatencyMs: null,
  scoreThreshold: null,
  failedCount: 0,
};

const DEMO_FALLBACK_ENV_ENABLED = process.env.NEXT_PUBLIC_ALLOW_DEMO_FALLBACK === "true";

function recomputeMetrics(
  inspectionHistory: InspectionResult[],
  batchFailures: InspectionState["batchFailures"],
): SessionMetrics {
  return computeSessionMetrics(
    inspectionHistory.filter((r) => !r.isDemoFallback && !r.isUnsupported),
    batchFailures.length,
  );
}

export const useInspectionStore = create<InspectionState>((set, get) => ({
  samples: [],
  selectedSampleId: null,
  currentResult: null,
  resultsBySampleId: {},
  timeline: [],
  inspectionHistory: [],
  batchFailures: [],
  sessionMetrics: EMPTY_METRICS,
  apiHealth: null,
  modelMetadata: null,
  isInitializing: true,
  isInspecting: false,
  isLineRunning: false,
  error: null,
  sequenceCounter: 0,
  selectedView: "original",
  selectedApiCategory: DEFAULT_API_CATEGORY,
  showCharts: false,
  demoFallbackEnvEnabled: DEMO_FALLBACK_ENV_ENABLED,
  sessionContainsDemoData: false,
  apiRecoveredAfterDemo: false,

  setSamples: (samples) =>
    set((state) => {
      const selectedStillExists =
        state.selectedSampleId != null && samples.some((s) => s.id === state.selectedSampleId);
      return {
        samples,
        selectedSampleId: selectedStillExists
          ? state.selectedSampleId
          : state.selectedSampleId != null
            ? null
            : state.selectedSampleId,
      };
    }),
  selectSample: (sampleId) =>
    set((state) => {
      if (sampleId == null) {
        return { selectedSampleId: null, currentResult: null };
      }
      const sample = state.samples.find((s) => s.id === sampleId);
      const cached = state.resultsBySampleId[sampleId] ?? null;
      return {
        selectedSampleId: sampleId,
        currentResult: cached,
        selectedApiCategory:
          sample && isSampleApiSupported(sample)
            ? DEFAULT_API_CATEGORY
            : state.selectedApiCategory,
      };
    }),
  setCurrentResult: (result) => set({ currentResult: result }),

  recordInspectionRun: (result, sample, sequenceNumber, options = {}) => {
    const entry = buildTimelineEntryFromResult(result, sequenceNumber, sample);
    if (options.isReprocess) {
      entry.isReprocess = true;
      entry.id = `${result.sampleId}-rerun-${sequenceNumber}`;
    }

    set((state) => {
      const hadDemo = state.sessionContainsDemoData;
      const isDemo = result.isDemoFallback;
      const apiRecoveredAfterDemo =
        hadDemo && !isDemo && state.demoFallbackEnvEnabled ? true : state.apiRecoveredAfterDemo;

      const inspectionHistory = [...state.inspectionHistory, result];

      const isActiveSample = state.selectedSampleId === result.sampleId;

      return {
        currentResult: isActiveSample ? result : state.currentResult,
        selectedSampleId: state.selectedSampleId,
        resultsBySampleId: { ...state.resultsBySampleId, [result.sampleId]: result },
        inspectionHistory,
        timeline: [...state.timeline, entry],
        sequenceCounter: sequenceNumber,
        sessionContainsDemoData: state.sessionContainsDemoData || isDemo,
        apiRecoveredAfterDemo,
        sessionMetrics: recomputeMetrics(inspectionHistory, state.batchFailures),
      };
    });
  },

  appendBatchOutcome: ({ results, timelineEntries, failures, isReprocess = false }) =>
    set((state) => {
      const resultsBySampleId = { ...state.resultsBySampleId };
      for (const result of results) {
        resultsBySampleId[result.sampleId] = result;
      }

      const stampedEntries = timelineEntries.map((entry) =>
        isReprocess ? { ...entry, isReprocess: true, id: `${entry.sampleId}-rerun-${entry.sequenceNumber}` } : entry,
      );

      const inspectionHistory = [...state.inspectionHistory, ...results];
      const batchFailures = [...state.batchFailures, ...failures];
      const containsDemo = results.some((r) => r.isDemoFallback);

      const selectedStillExists =
        state.selectedSampleId != null &&
        state.samples.some((s) => s.id === state.selectedSampleId);
      const currentResult =
        selectedStillExists && state.selectedSampleId
          ? resultsBySampleId[state.selectedSampleId] ?? state.currentResult
          : state.currentResult;

      return {
        resultsBySampleId,
        inspectionHistory,
        timeline: [...state.timeline, ...stampedEntries],
        batchFailures,
        sequenceCounter:
          stampedEntries.length > 0
            ? stampedEntries[stampedEntries.length - 1].sequenceNumber
            : state.sequenceCounter,
        sessionContainsDemoData: state.sessionContainsDemoData || containsDemo,
        sessionMetrics: recomputeMetrics(inspectionHistory, batchFailures),
        selectedSampleId: state.selectedSampleId,
        currentResult,
      };
    }),

  setApiHealth: (health) => set({ apiHealth: health }),
  setModelMetadata: (metadata) => set({ modelMetadata: metadata }),
  setInitializing: (value) => set({ isInitializing: value }),
  setInspecting: (value) => set({ isInspecting: value }),
  setLineRunning: (value) => set({ isLineRunning: value }),
  setError: (message) => set({ error: message }),
  nextSequenceNumber: () => {
    const next = get().sequenceCounter + 1;
    set({ sequenceCounter: next });
    return next;
  },
  setSelectedView: (view) => set({ selectedView: view }),
  setSelectedApiCategory: (category) => set({ selectedApiCategory: category }),
  setShowCharts: (value) => set({ showCharts: value }),
  markApiRecoveredAfterDemo: () => set({ apiRecoveredAfterDemo: true }),
  resetSession: () =>
    set({
      selectedSampleId: null,
      currentResult: null,
      resultsBySampleId: {},
      timeline: [],
      inspectionHistory: [],
      batchFailures: [],
      sessionMetrics: EMPTY_METRICS,
      sequenceCounter: 0,
      sessionContainsDemoData: false,
      apiRecoveredAfterDemo: false,
      error: null,
      isInspecting: false,
      isLineRunning: false,
    }),
  resetInspection: () =>
    set({
      selectedSampleId: null,
      currentResult: null,
      isInspecting: false,
      isLineRunning: false,
      selectedView: "original",
      selectedApiCategory: DEFAULT_API_CATEGORY,
      error: null,
    }),
}));

export function useSelectedSample(): InspectionSample | undefined {
  const samples = useInspectionStore((s) => s.samples);
  const selectedSampleId = useInspectionStore((s) => s.selectedSampleId);
  return samples.find((sample) => sample.id === selectedSampleId);
}

export function getPendingSamples(
  samples: InspectionSample[],
  resultsBySampleId: Record<string, InspectionResult>,
): InspectionSample[] {
  return samples.filter((sample) => !resultsBySampleId[sample.id]);
}

/** Select first catalog sample when nothing is selected yet. */
export function ensureDefaultSampleSelection(
  samples: InspectionSample[],
  selectedSampleId: string | null,
): string | null {
  if (selectedSampleId && samples.some((s) => s.id === selectedSampleId)) {
    return selectedSampleId;
  }
  return samples[0]?.id ?? null;
}
