import {
  DAE_BBOX_UI,
  DAE_EMPTY_BOXES_NOTE,
  getCategoryZThreshold,
  thresholdsMatchArtifact,
} from "@/config/mvtec-dae-artifacts";
import type { InspectionResult, InspectionSample, VerdictKind } from "@/types/inspection";
import type { PredictApiResponse, PredictBox } from "@/types/predict-api";
import { deriveScoreRatio } from "@/lib/inference-utils";
import {
  normalizeCategory,
  resolveSampleApiCategory,
  UNSUPPORTED_CATEGORY_MESSAGE,
} from "@/config/api-categories";

function asDataUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  if (value.startsWith("data:") || value.startsWith("http")) return value;
  return `data:image/png;base64,${value}`;
}

function parseBoxes(raw: unknown): PredictBox[] {
  if (!Array.isArray(raw)) return [];
  const boxes: PredictBox[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const x = Number(o.x);
    const y = Number(o.y);
    const w = Number(o.w);
    const h = Number(o.h);
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) continue;
    boxes.push({
      x,
      y,
      w,
      h,
      area: Number.isFinite(Number(o.area)) ? Number(o.area) : undefined,
      mean_z: Number.isFinite(Number(o.mean_z)) ? Number(o.mean_z) : undefined,
      max_z: Number.isFinite(Number(o.max_z)) ? Number(o.max_z) : undefined,
      score: Number.isFinite(Number(o.score)) ? Number(o.score) : undefined,
    });
  }
  return boxes;
}

export function verdictFromPredictStatus(
  status: string | undefined,
  isAnomaly: boolean,
): { display: string; kind: VerdictKind } {
  const raw = String(status ?? "").trim().toLowerCase();
  if (raw === "anomaly" || isAnomaly) return { display: "ANOMALY", kind: "anomaly" };
  if (raw === "normal" || !isAnomaly) return { display: "NORMAL", kind: "normal" };
  return { display: raw.toUpperCase(), kind: isAnomaly ? "anomaly" : "normal" };
}

export function mapPredictResponseToResult(
  sample: InspectionSample,
  payload: PredictApiResponse,
  latencyMs: number,
): InspectionResult {
  const verdict = verdictFromPredictStatus(payload.status, payload.is_anomaly);
  const scores = payload.scores ?? ({} as PredictApiResponse["scores"]);
  const imageSize = payload.image_size ?? { width: 256, height: 256 };
  const boxes = parseBoxes(payload.boxes);
  const images = payload.images ?? {};
  const debug = payload.debug ?? {};
  const model = payload.model ?? ({} as PredictApiResponse["model"]);

  const anomalyScore = Number(scores.anomaly_score);
  const scoreThreshold = Number(scores.threshold);
  const errorMean = Number(scores.error_mean);
  const zMapMax = Number(scores.z_map_max);

  const apiCategory = String(payload.category ?? "");
  const referenceThreshold = getCategoryZThreshold(apiCategory);

  const localizationNote =
    typeof debug.localization_note === "string" && debug.localization_note.trim()
      ? debug.localization_note.trim()
      : boxes.length === 0
        ? DAE_EMPTY_BOXES_NOTE
        : DAE_BBOX_UI.disclaimer;

  const apiStatus = String(payload.status ?? verdict.kind).trim().toLowerCase();

  return {
    sampleId: sample.id,
    sampleName: sample.name,
    verdict: verdict.display,
    verdictKind: verdict.kind,
    status: apiStatus,
    isAnomaly: Boolean(payload.is_anomaly),
    apiCategory,
    anomalyScore: Number.isFinite(anomalyScore) ? anomalyScore : null,
    scoreThreshold: Number.isFinite(scoreThreshold) ? scoreThreshold : null,
    errorMean: Number.isFinite(errorMean) ? errorMean : null,
    zMapMax: Number.isFinite(zMapMax) ? zMapMax : null,
    scoreRatio: deriveScoreRatio(anomalyScore, scoreThreshold),
    imageSize: {
      width: Number(imageSize.width) || 256,
      height: Number(imageSize.height) || 256,
    },
    boxes,
    hasBoxes: boxes.length > 0,
    images: {
      original: asDataUrl(images.original),
      reconstruction: asDataUrl(images.reconstruction),
      heatmap: asDataUrl(images.heatmap),
      mask: asDataUrl(images.mask),
    },
    model: {
      experimentName: model.experiment_name ?? null,
      modelName: model.model_name ?? null,
      scoreName: model.score_name ?? null,
    },
    localizationNote,
    bboxMethod: debug.bbox_method ?? null,
    referenceThreshold,
    thresholdMatchesArtifact: thresholdsMatchArtifact(scoreThreshold, apiCategory),
    latencyMs:
      typeof debug.latency_ms === "number" && Number.isFinite(debug.latency_ms)
        ? debug.latency_ms
        : latencyMs,
    timestamp: new Date().toISOString(),
    isDemoFallback: false,
    raw: payload,
  };
}

export function buildUnsupportedCategoryResult(
  sample: InspectionSample,
  category: string,
  message: string = UNSUPPORTED_CATEGORY_MESSAGE,
): InspectionResult {
  return {
    sampleId: sample.id,
    sampleName: sample.name,
    verdict: "UNSUPPORTED",
    verdictKind: "unsupported",
    status: "unsupported",
    isAnomaly: false,
    isUnsupported: true,
    unsupportedMessage: message,
    apiCategory: category,
    anomalyScore: null,
    scoreThreshold: null,
    errorMean: null,
    zMapMax: null,
    scoreRatio: null,
    imageSize: { width: 256, height: 256 },
    boxes: [],
    hasBoxes: false,
    images: {
      original: null,
      reconstruction: null,
      heatmap: null,
      mask: null,
    },
    model: {
      experimentName: null,
      modelName: null,
      scoreName: null,
    },
    localizationNote: null,
    bboxMethod: null,
    referenceThreshold: null,
    thresholdMatchesArtifact: null,
    latencyMs: 0,
    timestamp: new Date().toISOString(),
    isDemoFallback: false,
    raw: { status: "unsupported", category, message },
  };
}

export function buildDemoFallbackResult(sample: InspectionSample): InspectionResult {
  const isAnomaly = sample.label === "anomaly";
  const apiCategory = resolveSampleApiCategory(sample);
  if (!apiCategory) {
    const raw = String(sample.metadata?.product ?? sample.category ?? "unknown");
    return buildUnsupportedCategoryResult(sample, normalizeCategory(raw));
  }
  const scoreThreshold = getCategoryZThreshold(apiCategory) ?? 3.91;
  const anomalyScore = isAnomaly ? scoreThreshold * 1.15 : scoreThreshold * 0.85;

  return {
    sampleId: sample.id,
    sampleName: sample.name,
    verdict: isAnomaly ? "ANOMALY" : "NORMAL",
    verdictKind: isAnomaly ? "anomaly" : "normal",
    status: isAnomaly ? "anomaly" : "normal",
    isAnomaly,
    apiCategory,
    anomalyScore,
    scoreThreshold,
    errorMean: isAnomaly ? 0.012 : 0.008,
    zMapMax: isAnomaly ? 8.5 : 2.1,
    scoreRatio: anomalyScore / scoreThreshold,
    imageSize: { width: 256, height: 256 },
    boxes: [],
    hasBoxes: false,
    images: {
      original: null,
      reconstruction: null,
      heatmap: null,
      mask: null,
    },
    model: {
      experimentName: "mvtec_structured_objects_dae_v1",
      modelName: "multi_product_denoising_conv_autoencoder",
      scoreName: "top_1_z_score",
    },
    localizationNote: DAE_EMPTY_BOXES_NOTE,
    referenceThreshold: scoreThreshold,
    thresholdMatchesArtifact: true,
    bboxMethod: "demo",
    latencyMs: 0,
    timestamp: new Date().toISOString(),
    isDemoFallback: true,
  };
}
