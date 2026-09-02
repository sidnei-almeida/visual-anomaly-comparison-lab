/**
 * Inference entry point for the lab.
 *
 * The hosted Hugging Face API this app used to call was retired, so the model now runs
 * in the visitor's browser via onnxruntime-web. The exported surface still speaks the
 * `POST /predict` response shape the UI was built around, so callers did not change.
 */

import type { ApiCategory } from "@/config/api-categories";
import { isApiCategory } from "@/config/api-categories";
import {
  DAE_EXPERIMENT_NAME,
  DAE_MODEL_NAME,
  DAE_RECOMMENDED_SCORE,
} from "@/config/mvtec-dae-artifacts";
import type { ApiHealth, ApiMetadata, InspectionSample } from "@/types/inspection";
import type { PredictApiResponse, PredictOutcome, PredictRequestOptions } from "@/types/predict-api";
import { curatedSampleToFile } from "@/lib/sample-loader";
import { decodeToModelInput, encodeGrayToDataUrl, encodeRgbToDataUrl } from "@/lib/inference/image-io";
import {
  ensureModelLoaded,
  reconstruct,
  type ModelLoadProgress,
} from "@/lib/inference/model-session";
import {
  BBOX_METHOD,
  IMAGE_SIZE,
  LOCALIZATION_NOTE,
  runPipeline,
  rgbToTensor,
  SCORE_NAME,
} from "@/lib/inference/pipeline";

export type { ModelLoadProgress };

const FRIENDLY_ERROR = "Could not process the image. Please try again.";

function assertValidCategory(category: string): asserts category is ApiCategory {
  if (!isApiCategory(category)) {
    throw new Error("Invalid category for this model. Choose a supported product category.");
  }
}

/** Model identity — served from the exported training artifacts, not from a remote API. */
export async function fetchApiMetadata(): Promise<ApiMetadata> {
  return {
    modelName: DAE_MODEL_NAME,
    experimentName: DAE_EXPERIMENT_NAME,
    scoreName: DAE_RECOMMENDED_SCORE,
  };
}

/** Readiness of the in-browser engine, shaped like the old `/health` response. */
export async function getApiHealth(signal?: AbortSignal): Promise<ApiHealth> {
  if (signal?.aborted) {
    throw new Error("Request aborted.");
  }

  try {
    await ensureModelLoaded();
    return {
      status: "online",
      rawStatus: "ready",
      modelLoaded: true,
      apiReachable: true,
      modelName: DAE_MODEL_NAME,
      message: "Model ready",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Model failed to load.";
    return {
      status: "offline",
      rawStatus: "error",
      modelLoaded: false,
      apiReachable: false,
      modelName: DAE_MODEL_NAME,
      message,
    };
  }
}

export function assertApiReadyForInference(health: ApiHealth): void {
  if (health.rawStatus === "loading") {
    throw new Error("Model is still loading, try again in a few seconds.");
  }
  if (!health.modelLoaded) {
    throw new Error(health.message ?? "Model not ready.");
  }
}

/** Warm up the engine ahead of the first inspection, reporting download progress. */
export function preloadModel(
  onProgress?: (progress: ModelLoadProgress) => void,
): Promise<unknown> {
  return ensureModelLoaded(onProgress);
}

/** Run the autoencoder locally and return the `/predict` payload the UI consumes. */
export async function predictAnomaly(
  file: Blob,
  options: PredictRequestOptions,
): Promise<PredictOutcome> {
  if (!file || file.size === 0) {
    throw new Error("No image provided. Select or upload a sample first.");
  }

  assertValidCategory(options.category);

  const model = await ensureModelLoaded();
  const start = performance.now();

  let rgb: Uint8ClampedArray;
  try {
    rgb = await decodeToModelInput(file);
  } catch (error) {
    throw error instanceof Error ? error : new Error(FRIENDLY_ERROR);
  }

  if (options.signal?.aborted) {
    throw new Error("Inspection cancelled.");
  }

  const inputTensor = rgbToTensor(rgb);
  const reconstruction = await reconstruct(model, inputTensor);
  const result = runPipeline(rgb, inputTensor, reconstruction, model.profile, options.category);
  const latencyMs = performance.now() - start;

  const payload: PredictApiResponse = {
    status: result.status,
    is_anomaly: result.isAnomaly,
    category: options.category,
    model: {
      experiment_name: DAE_EXPERIMENT_NAME,
      model_name: DAE_MODEL_NAME,
      score_name: SCORE_NAME,
    },
    scores: {
      anomaly_score: result.anomalyScore,
      threshold: result.threshold,
      error_mean: result.errorMean,
      z_map_max: result.zMapMax,
    },
    image_size: { width: IMAGE_SIZE, height: IMAGE_SIZE },
    boxes: result.boxes,
    debug: {
      bbox_method: BBOX_METHOD,
      localization_note: LOCALIZATION_NOTE,
      latency_ms: Number(latencyMs.toFixed(3)),
    },
  };

  if (options.includeImages ?? true) {
    const [original, reconstructionImage, heatmap, mask] = await Promise.all([
      encodeRgbToDataUrl(result.originalRgb),
      encodeRgbToDataUrl(result.reconstructionRgb),
      encodeRgbToDataUrl(result.heatmapRgb),
      encodeGrayToDataUrl(result.maskGray),
    ]);
    payload.images = { original, reconstruction: reconstructionImage, heatmap, mask };
  }

  return { payload, latencyMs };
}

export async function inspectSample(
  sample: InspectionSample,
  options: PredictRequestOptions,
): Promise<PredictOutcome> {
  const file = await curatedSampleToFile(sample);
  return predictAnomaly(file, options);
}

export async function inspectUpload(
  file: Blob,
  options: PredictRequestOptions,
): Promise<PredictOutcome> {
  return predictAnomaly(file, options);
}

export const anomalyApi = {
  fetchApiMetadata,
  getApiHealth,
  preloadModel,
  predictAnomaly,
  inspectSample,
  inspectUpload,
};

export default anomalyApi;
