import type { ApiCategory } from "@/config/api-categories";
import {
  isSampleApiSupported,
  resolveApiCategoryForRequest,
} from "@/config/api-categories";
import type {
  ApiMetadata,
  InspectionResult,
  InspectionSample,
  TimelineEntry,
  VerdictKind,
} from "@/types/inspection";
import type { SessionMetrics } from "@/types/inference";
import {
  mapPredictResponseToResult,
  buildDemoFallbackResult,
} from "@/lib/predict-mapper";
import { listCuratedSamples } from "@/lib/sample-loader";
import {
  buildTimelineEntryFromResult,
  computeSessionMetrics,
  deriveScoreRatio,
  sortTimelineBySequence,
  timelineMarkersFromSequence,
  formatSampleSequenceLabel,
} from "@/lib/inference-utils";
import { api } from "@/services/api";
import { assertApiReadyForInference } from "@/lib/anomaly-api";

export type UiSampleStatus = "ok" | "anomaly" | "review" | "unsupported";

export interface LabBootstrap {
  health: Awaited<ReturnType<typeof api.getHealth>>;
  metadata: ApiMetadata;
  samples: InspectionSample[];
}

export interface DashboardMetrics {
  verdict: string;
  verdictKind: VerdictKind;
  isAnomaly: boolean;
  apiCategory: string;
  anomalyScore: number | null;
  scoreThreshold: number | null;
  errorMean: number | null;
  zMapMax: number | null;
  scoreRatio: number | null;
  latencyMs: number | null;
  severity: string;
  experimentName: string | null;
  modelName: string | null;
  scoreName: string | null;
  hasBoxes: boolean;
  localizationNote: string | null;
  isDemoFallback: boolean;
  isUnsupported?: boolean;
  unsupportedMessage?: string | null;
}

export interface BatchInspectionOutcome {
  results: InspectionResult[];
  timelineEntries: TimelineEntry[];
  failures: Array<{ sampleId: string; fileName: string; message: string }>;
  metrics: SessionMetrics;
}

const DEMO_FALLBACK_ENABLED = process.env.NEXT_PUBLIC_ALLOW_DEMO_FALLBACK === "true";

function buildPredictOptions(
  category: ApiCategory,
  signal?: AbortSignal,
): Parameters<typeof api.inspectSample>[1] {
  return {
    category,
    includeImages: true,
    includeDebug: false,
    includeOverlay: false,
    signal,
  };
}

function resolveCategoryForSample(sample: InspectionSample): ApiCategory {
  return resolveApiCategoryForRequest(sample);
}

export { isSampleApiSupported };

export async function bootstrapLab(signal?: AbortSignal): Promise<LabBootstrap> {
  const [health, metadata] = await Promise.all([
    api.getHealth(signal),
    api.getMetadata(),
  ]);

  return {
    health,
    metadata,
    samples: listCuratedSamples(),
  };
}

export async function inspectSampleRemote(
  sample: InspectionSample,
  metadata: ApiMetadata,
  manualCategory: ApiCategory | null,
  signal?: AbortSignal,
): Promise<InspectionResult> {
  const category = resolveCategoryForSample(sample);

  const health = await api.getHealth(signal);
  assertApiReadyForInference(health);

  const { payload, latencyMs } = await api.inspectSample(sample, buildPredictOptions(category, signal));
  return mapPredictResponseToResult(sample, payload, latencyMs);
}

export async function inspectUploadRemote(
  file: File,
  sample: InspectionSample,
  metadata: ApiMetadata,
  manualCategory: ApiCategory | null,
  signal?: AbortSignal,
): Promise<InspectionResult> {
  const category = resolveCategoryForSample(sample);

  const health = await api.getHealth(signal);
  assertApiReadyForInference(health);

  const { payload, latencyMs } = await api.inspectUpload(file, buildPredictOptions(category, signal));
  return mapPredictResponseToResult(sample, payload, latencyMs);
}

export function inspectSampleFallback(sample: InspectionSample): InspectionResult {
  return buildDemoFallbackResult(sample);
}

export async function inspectSampleWithFallback(
  sample: InspectionSample,
  metadata: ApiMetadata,
  manualCategory: ApiCategory | null,
  signal?: AbortSignal,
): Promise<InspectionResult> {
  try {
    return await inspectSampleRemote(sample, metadata, manualCategory, signal);
  } catch (error) {
    if (!DEMO_FALLBACK_ENABLED) throw error;
    const fallback = inspectSampleFallback(sample);
    fallback.raw = {
      error: error instanceof Error ? error.message : "Inspection failed",
    };
    return fallback;
  }
}

export async function inspectSamplesBatch(
  samples: InspectionSample[],
  metadata: ApiMetadata,
  manualCategory: ApiCategory | null,
  options: {
    signal?: AbortSignal;
    onProgress?: (index: number, total: number, sample: InspectionSample) => void;
    allowDemoFallback?: boolean;
    gapMs?: number;
    startingSequenceNumber?: number;
  } = {},
): Promise<BatchInspectionOutcome> {
  const results: InspectionResult[] = [];
  const timelineEntries: TimelineEntry[] = [];
  const failures: BatchInspectionOutcome["failures"] = [];
  let sequenceNumber = options.startingSequenceNumber ?? 0;

  let healthChecked = false;

  for (let index = 0; index < samples.length; index += 1) {
    if (options.signal?.aborted) break;
    const sample = samples[index];
    options.onProgress?.(index, samples.length, sample);

    try {
      if (!healthChecked) {
        const health = await api.getHealth(options.signal);
        assertApiReadyForInference(health);
        healthChecked = true;
      }

      const result = options.allowDemoFallback
        ? await inspectSampleWithFallback(sample, metadata, manualCategory, options.signal)
        : await inspectSampleRemote(sample, metadata, manualCategory, options.signal);
      sequenceNumber += 1;
      results.push(result);
      timelineEntries.push(buildTimelineEntryFromResult(result, sequenceNumber, sample));
    } catch (error) {
      failures.push({
        sampleId: sample.id,
        fileName: sample.filename,
        message: error instanceof Error ? error.message : "Could not process the image. Please try again.",
      });
    }

    if (options.gapMs && index < samples.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, options.gapMs));
    }
  }

  return {
    results,
    timelineEntries,
    failures,
    metrics: computeSessionMetrics(results, failures.length),
  };
}

export const sortTimelineEntries = sortTimelineBySequence;
export const formatTimelineMarkers = timelineMarkersFromSequence;
export const resultToTimelineEntry = buildTimelineEntryFromResult;

export function formatTimelineLabel(entry: TimelineEntry): string {
  const base = formatSampleSequenceLabel(entry.sequenceNumber);
  return entry.isReprocess ? `${base} ↺` : base;
}

export function formatTimelineTooltip(entry: TimelineEntry): string {
  const label = formatTimelineLabel(entry);
  const lines = [
    label,
    `Category: ${entry.apiCategory}`,
    `Status: ${entry.verdict}`,
    `Severity: ${entry.severity}`,
  ];
  if (entry.anomalyScore != null && Number.isFinite(entry.anomalyScore)) {
    lines.push(`Score: ${entry.anomalyScore.toFixed(3)}`);
  }
  return lines.join("\n");
}

export function resultToDashboardMetrics(result: InspectionResult | null): DashboardMetrics | null {
  if (!result) return null;

  if (result.isUnsupported) {
    return null;
  }

  return {
    verdict: result.verdict,
    verdictKind: result.verdictKind,
    isAnomaly: result.isAnomaly,
    apiCategory: result.apiCategory,
    anomalyScore: result.anomalyScore,
    scoreThreshold: result.scoreThreshold,
    errorMean: result.errorMean,
    zMapMax: result.zMapMax,
    scoreRatio: deriveScoreRatio(result.anomalyScore, result.scoreThreshold),
    latencyMs: result.latencyMs,
    severity: buildTimelineEntryFromResult(result, 0).severity,
    experimentName: result.model.experimentName,
    modelName: result.model.modelName,
    scoreName: result.model.scoreName,
    hasBoxes: result.hasBoxes,
    localizationNote: result.localizationNote,
    isDemoFallback: result.isDemoFallback,
  };
}

export function deriveSessionMetricsFromResults(
  results: InspectionResult[],
  failedCount = 0,
): SessionMetrics {
  return computeSessionMetrics(results, failedCount);
}

export function verdictKindToUiStatus(kind: VerdictKind): UiSampleStatus {
  if (kind === "unsupported") return "unsupported";
  if (kind === "anomaly") return "anomaly";
  if (kind === "normal") return "ok";
  return "review";
}

export function getSampleDisplayId(sample: InspectionSample, index: number): string {
  return `#${String(index + 1).padStart(3, "0")}`;
}

export function isApiReady(health: LabBootstrap["health"] | null): boolean {
  return Boolean(health?.apiReachable && health.modelLoaded && health.rawStatus === "ready");
}

export function isApiLoading(health: LabBootstrap["health"] | null): boolean {
  return Boolean(
    health?.apiReachable &&
      (health.rawStatus === "loading" || health.rawStatus === "starting"),
  );
}
