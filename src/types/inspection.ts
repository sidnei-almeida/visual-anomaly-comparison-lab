import type { DashboardSeverity } from "@/types/inference";
import type { PredictApiResponse, PredictBox } from "@/types/predict-api";

/** Primary verdict labels for inspection UI. */
export type InspectionVerdict = "normal" | "anomaly" | "review";

/** Extended verdict states used by engine/timeline error handling. */
export type VerdictKind = InspectionVerdict | "empty" | "error" | "unsupported";

/** Inspection view modes for the Comparison Lab grid. */
export type InspectionView = "original" | "reconstruction" | "heatmap" | "mask";

export type SampleLabel = InspectionVerdict | "unknown";

export type SampleSource = "curated" | "upload";

/** Curated or uploaded inspection input. */
export interface InspectionSample {
  id: string;
  name: string;
  label?: InspectionVerdict | SampleLabel;
  imageUrl: string;
  filename: string;
  category?: string;
  source?: SampleSource;
  rotation?: number;
  metadata?: Record<string, unknown>;
}

export type { PredictBox };

export interface InspectionImages {
  original: string | null;
  reconstruction: string | null;
  heatmap: string | null;
  mask: string | null;
}

export interface InspectionModelInfo {
  experimentName: string | null;
  modelName: string | null;
  scoreName: string | null;
}

/** Normalized result for UI and timeline — maps POST /predict response. */
export interface InspectionResult {
  sampleId: string;
  sampleName: string;
  verdict: string;
  verdictKind: VerdictKind;
  /** API `status` — normal | anomaly */
  status: string;
  isAnomaly: boolean;
  apiCategory: string;
  anomalyScore: number | null;
  scoreThreshold: number | null;
  errorMean: number | null;
  zMapMax: number | null;
  scoreRatio: number | null;
  imageSize: { width: number; height: number };
  boxes: PredictBox[];
  hasBoxes: boolean;
  images: InspectionImages;
  model: InspectionModelInfo;
  localizationNote: string | null;
  bboxMethod: string | null;
  /** p95 top_1_z_score from mvtec_structured_objects_dae_v1_thresholds.json */
  referenceThreshold: number | null;
  thresholdMatchesArtifact: boolean | null;
  latencyMs: number;
  timestamp: string;
  isDemoFallback: boolean;
  isUnsupported?: boolean;
  unsupportedMessage?: string | null;
  raw?: PredictApiResponse | Record<string, unknown>;
}

export interface ApiHealth {
  status: "online" | "offline" | "degraded";
  rawStatus?: string;
  modelLoaded?: boolean;
  apiReachable?: boolean;
  modelName?: string;
  message?: string;
}

export interface ApiMetadata {
  modelName: string | null;
  experimentName: string | null;
  scoreName: string | null;
}

export interface TimelineEntry {
  id: string;
  sequenceNumber: number;
  runNumber: number;
  sampleId: string;
  sampleName: string;
  fileName: string;
  datasetClass?: string;
  apiCategory: string;
  prediction: string;
  anomalyScore: number | null;
  scoreThreshold: number | null;
  timestamp: string;
  latencyMs: number | null;
  verdict: string;
  verdictKind: VerdictKind;
  severity: DashboardSeverity;
  status: VerdictKind | "error";
  errorMessage?: string;
  isDemoFallback?: boolean;
  isReprocess?: boolean;
}
