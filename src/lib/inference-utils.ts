import type { DashboardSeverity, SessionMetrics } from "@/types/inference";
import type { InspectionResult, InspectionSample, TimelineEntry } from "@/types/inspection";
import { deriveDashboardSeverityFromRatio, deriveScoreRatio } from "@/lib/gauge-utils";

export { deriveDashboardSeverityFromRatio, deriveScoreRatio } from "@/lib/gauge-utils";

/**
 * Dashboard severity from anomaly_score vs category threshold (top_1_z_score).
 */
export function deriveDashboardSeverity(
  isAnomaly: boolean,
  anomalyScore: number | null | undefined,
  scoreThreshold: number | null | undefined,
): DashboardSeverity {
  const ratio = deriveScoreRatio(anomalyScore, scoreThreshold);
  if (ratio != null) return deriveDashboardSeverityFromRatio(ratio);
  return isAnomaly ? "Low" : "Normal";
}

export function inferDatasetClass(sample: InspectionSample): string | undefined {
  if (sample.category) return sample.category;
  const product = sample.metadata?.product;
  if (typeof product === "string") return product;
  const name = `${sample.filename} ${sample.name}`.toLowerCase();
  if (name.includes("good") || name.includes("pass")) return "good";
  if (name.includes("defect") || name.includes("anomaly") || name.includes("break")) return "defect";
  return undefined;
}

export function formatSampleSequenceLabel(sequenceNumber: number): string {
  return `Sample #${String(sequenceNumber).padStart(3, "0")}`;
}

export function computeSessionMetrics(
  results: InspectionResult[],
  failedCount = 0,
): SessionMetrics {
  const processed = results.filter((r) => !r.isDemoFallback && !r.isUnsupported);
  const totalProcessed = processed.length;

  let normalCount = 0;
  let anomalyCount = 0;
  const scores: number[] = [];
  const errorMeans: number[] = [];
  const latencies: number[] = [];
  let scoreThreshold: number | null = null;

  for (const result of processed) {
    if (result.verdictKind === "normal") normalCount += 1;
    if (result.verdictKind === "anomaly") anomalyCount += 1;

    if (result.anomalyScore != null && Number.isFinite(result.anomalyScore)) {
      scores.push(result.anomalyScore);
    }
    if (result.errorMean != null && Number.isFinite(result.errorMean)) {
      errorMeans.push(result.errorMean);
    }
    if (result.latencyMs != null && Number.isFinite(result.latencyMs)) {
      latencies.push(result.latencyMs);
    }
    if (result.scoreThreshold != null) {
      scoreThreshold = result.scoreThreshold;
    }
  }

  const avg = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

  return {
    totalProcessed,
    normalCount,
    anomalyCount,
    anomalyRate: totalProcessed ? anomalyCount / totalProcessed : 0,
    avgAnomalyScore: avg(scores),
    maxAnomalyScore: scores.length ? Math.max(...scores) : null,
    minAnomalyScore: scores.length ? Math.min(...scores) : null,
    avgErrorMean: avg(errorMeans),
    avgLatencyMs: avg(latencies),
    scoreThreshold,
    failedCount,
  };
}

export function buildTimelineEntryFromResult(
  result: InspectionResult,
  sequenceNumber: number,
  sample?: InspectionSample,
): TimelineEntry {
  const severity = result.isUnsupported
    ? "Normal"
    : deriveDashboardSeverity(result.isAnomaly, result.anomalyScore, result.scoreThreshold);

  return {
    id: `${result.sampleId}-${sequenceNumber}`,
    sequenceNumber,
    runNumber: sequenceNumber,
    sampleId: result.sampleId,
    sampleName: result.sampleName,
    fileName: sample?.filename ?? result.sampleName,
    datasetClass: sample ? inferDatasetClass(sample) : undefined,
    apiCategory: result.apiCategory,
    prediction: result.verdict,
    anomalyScore: result.anomalyScore,
    scoreThreshold: result.scoreThreshold,
    verdict: result.verdict,
    verdictKind: result.verdictKind,
    status: result.isUnsupported
      ? "unsupported"
      : result.verdictKind === "error"
        ? "error"
        : result.verdictKind,
    severity,
    latencyMs: result.latencyMs ?? null,
    timestamp: result.timestamp,
    errorMessage: result.verdictKind === "error" ? result.verdict : undefined,
    isDemoFallback: result.isDemoFallback,
  };
}

export function sortTimelineBySequence(entries: TimelineEntry[]): TimelineEntry[] {
  return [...entries].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
}

export function timelineMarkersFromSequence(entries: TimelineEntry[]): string[] {
  if (!entries.length) return [];
  const sorted = sortTimelineBySequence(entries);
  const picks = [
    sorted[0],
    sorted[Math.floor(sorted.length / 4)],
    sorted[Math.floor(sorted.length / 2)],
    sorted[Math.floor((sorted.length * 3) / 4)],
    sorted[sorted.length - 1],
  ].filter(Boolean) as TimelineEntry[];

  return Array.from(new Set(picks.map((e) => formatSampleSequenceLabel(e.sequenceNumber))));
}
