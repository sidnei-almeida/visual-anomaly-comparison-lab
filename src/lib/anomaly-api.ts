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

const DEFAULT_BASE_URL =
  process.env.NEXT_PUBLIC_ANOMALY_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_ANOMALY_API_BASE_URL ??
  process.env.NEXT_PUBLIC_VITE_API_BASE_URL ??
  "https://salmeida-bottle-anomaly-detection.hf.space";

const DEFAULT_FETCH_TIMEOUT_MS = 8_000;
const DEFAULT_PREDICT_TIMEOUT_MS = 30_000;

const FRIENDLY_ERROR = "Could not process the image. Please try again.";

function joinUrl(base: string, path: string): string {
  const normalizedBase = base.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

async function fetchJson<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const externalSignal = options.signal;
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      const text = await response.text();
      if (response.status === 400 && text.toLowerCase().includes("category")) {
        throw new Error("Invalid category for this model. Choose a supported product category.");
      }
      if (response.status >= 500) {
        throw new Error(FRIENDLY_ERROR);
      }
      throw new Error(text || FRIENDLY_ERROR);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timed out.");
    }
    if (error instanceof Error && error.message) throw error;
    throw new Error(FRIENDLY_ERROR);
  } finally {
    clearTimeout(timer);
  }
}

export function getApiBaseUrl(): string {
  return DEFAULT_BASE_URL;
}

function assertValidCategory(category: string): asserts category is ApiCategory {
  if (!isApiCategory(category)) {
    throw new Error("Invalid category for this model. Choose a supported product category.");
  }
}

function validatePredictPayload(data: unknown): PredictApiResponse {
  if (!data || typeof data !== "object") {
    throw new Error(FRIENDLY_ERROR);
  }
  const payload = data as Record<string, unknown>;
  if (typeof payload.is_anomaly !== "boolean") {
    throw new Error(FRIENDLY_ERROR);
  }
  if (!payload.scores || typeof payload.scores !== "object") {
    throw new Error(FRIENDLY_ERROR);
  }
  return data as PredictApiResponse;
}

/** GET / — optional metadata (falls back to DAE defaults). */
export async function fetchApiMetadata(
  baseUrl = getApiBaseUrl(),
  signal?: AbortSignal,
): Promise<ApiMetadata> {
  try {
    const data = await fetchJson<Record<string, unknown>>(joinUrl(baseUrl, "/"), { signal });
    return {
      modelName: typeof data.model_name === "string" ? data.model_name : DAE_MODEL_NAME,
      experimentName:
        typeof data.experiment_name === "string" ? data.experiment_name : DAE_EXPERIMENT_NAME,
      scoreName: typeof data.score_name === "string" ? data.score_name : DAE_RECOMMENDED_SCORE,
    };
  } catch {
    return {
      modelName: DAE_MODEL_NAME,
      experimentName: DAE_EXPERIMENT_NAME,
      scoreName: DAE_RECOMMENDED_SCORE,
    };
  }
}

/** GET /health — API readiness. */
export async function getApiHealth(
  baseUrl = getApiBaseUrl(),
  signal?: AbortSignal,
): Promise<ApiHealth> {
  try {
    const data = await fetchJson<Record<string, unknown>>(joinUrl(baseUrl, "/health"), { signal });
    const rawStatus = String(data.status ?? "unknown").toLowerCase();
    const modelLoaded = rawStatus === "ready" || rawStatus === "ok";
    const isLoading = rawStatus === "loading" || rawStatus === "starting";

    let message = "Model ready";
    if (isLoading) {
      message = "Model is loading, try again in a few seconds.";
    } else if (!modelLoaded) {
      message = `Status: ${rawStatus}`;
    }

    return {
      status: modelLoaded ? "online" : "degraded",
      rawStatus,
      modelLoaded,
      apiReachable: true,
      modelName:
        typeof data.model_name === "string"
          ? data.model_name
          : "multi_product_denoising_conv_autoencoder",
      message,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "API offline";
    return {
      status: "offline",
      rawStatus: "offline",
      modelLoaded: false,
      apiReachable: false,
      message: message.includes("timed out") ? "API offline — request timed out." : "API offline",
    };
  }
}

export function assertApiReadyForInference(health: ApiHealth): void {
  if (!health.apiReachable) {
    throw new Error(health.message ?? "API unavailable.");
  }
  if (health.rawStatus === "loading" || health.rawStatus === "starting") {
    throw new Error("Model is loading, try again in a few seconds.");
  }
  if (!health.modelLoaded) {
    throw new Error(health.message ?? "Model not ready.");
  }
}

/** POST /predict — multipart image + category. */
export async function predictAnomaly(
  file: Blob,
  options: PredictRequestOptions,
  baseUrl = getApiBaseUrl(),
): Promise<PredictOutcome> {
  if (!file || file.size === 0) {
    throw new Error("No image provided. Select or upload a sample first.");
  }

  assertValidCategory(options.category);

  const form = new FormData();
  form.append("file", file);
  form.append("category", options.category);
  form.append("include_images", String(options.includeImages ?? true));
  form.append("include_debug", String(options.includeDebug ?? false));
  form.append("include_overlay", String(options.includeOverlay ?? false));

  const predictUrl = joinUrl(baseUrl, "/predict");
  const start = performance.now();

  const raw = await fetchJson<unknown>(
    predictUrl,
    {
      method: "POST",
      body: form,
      signal: options.signal,
    },
    options.timeoutMs ?? DEFAULT_PREDICT_TIMEOUT_MS,
  );

  const payload = validatePredictPayload(raw);
  const latencyMs =
    typeof payload.debug?.latency_ms === "number"
      ? payload.debug.latency_ms
      : performance.now() - start;

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

/** @deprecated Use getApiHealth */
export const fetchApiHealth = getApiHealth;

/** @deprecated Use predictAnomaly */
export const inferAnomaly = predictAnomaly;

export const anomalyApi = {
  getApiBaseUrl,
  fetchApiMetadata,
  getApiHealth,
  predictAnomaly,
  inspectSample,
  inspectUpload,
};

export default anomalyApi;
