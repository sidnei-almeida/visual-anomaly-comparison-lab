/**
 * Loads and caches the browser-side inference runtime.
 *
 * The model, its category error profile and the onnxruntime-web WebAssembly binary are
 * all static assets under `public/`, so inference runs entirely in the visitor's browser
 * and the app needs no server-side compute.
 */

import type { InferenceSession, Tensor } from "onnxruntime-web";
import { IMAGE_SIZE, PIXEL_COUNT, type CategoryProfile } from "@/lib/inference/pipeline";

export const MODEL_URL = "/model/dae-bottle.onnx";
export const PROFILE_URL = "/model/bottle-profile.bin";
export const ORT_WASM_PATH = "/ort/";

const INPUT_NAME = "image";
/** Model file plus profile; used to weight the download progress reported to the UI. */
const APPROXIMATE_TOTAL_BYTES = 5_529_000 + 524_288;

export interface ModelLoadProgress {
  /** 0 to 1, best-effort. */
  ratio: number;
  stage: "runtime" | "weights" | "profile" | "warmup" | "ready";
}

export interface LoadedModel {
  session: InferenceSession;
  profile: CategoryProfile;
}

type ProgressHandler = (progress: ModelLoadProgress) => void;

let modelPromise: Promise<LoadedModel> | null = null;
let ortModule: typeof import("onnxruntime-web") | null = null;

async function loadRuntime(): Promise<typeof import("onnxruntime-web")> {
  if (ortModule) return ortModule;

  const ort = await import("onnxruntime-web/wasm");
  ort.env.wasm.wasmPaths = ORT_WASM_PATH;
  // Multithreading needs cross-origin isolation, which would break third-party embeds.
  ort.env.wasm.numThreads = 1;
  ort.env.logLevel = "error";

  ortModule = ort as unknown as typeof import("onnxruntime-web");
  return ortModule;
}

/** Fetch a binary asset, reporting progress while the body streams in. */
async function fetchBinary(
  url: string,
  onBytes?: (loaded: number, total: number | null) => void,
): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url} (HTTP ${response.status}).`);
  }

  const declared = Number(response.headers.get("content-length"));
  const total = Number.isFinite(declared) && declared > 0 ? declared : null;

  if (!response.body || !onBytes) {
    return response.arrayBuffer();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onBytes(loaded, total);
  }

  const buffer = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buffer.buffer;
}

function parseProfile(buffer: ArrayBuffer): CategoryProfile {
  const expectedBytes = PIXEL_COUNT * 2 * Float32Array.BYTES_PER_ELEMENT;
  if (buffer.byteLength !== expectedBytes) {
    throw new Error(
      `Error profile has ${buffer.byteLength} bytes, expected ${expectedBytes}. ` +
        "Re-run `npm run model:export`.",
    );
  }

  const values = new Float32Array(buffer);
  return {
    mean: values.subarray(0, PIXEL_COUNT),
    std: values.subarray(PIXEL_COUNT, PIXEL_COUNT * 2),
  };
}

async function createSession(
  ort: typeof import("onnxruntime-web"),
  weights: ArrayBuffer,
): Promise<InferenceSession> {
  return ort.InferenceSession.create(weights, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });
}

async function loadModel(onProgress?: ProgressHandler): Promise<LoadedModel> {
  const report = (ratio: number, stage: ModelLoadProgress["stage"]) => {
    onProgress?.({ ratio: Math.min(Math.max(ratio, 0), 1), stage });
  };

  report(0.02, "runtime");
  const ort = await loadRuntime();

  report(0.08, "weights");
  const weights = await fetchBinary(MODEL_URL, (loaded, total) => {
    const fraction = loaded / (total ?? APPROXIMATE_TOTAL_BYTES);
    report(0.08 + fraction * 0.6, "weights");
  });

  report(0.7, "profile");
  const profileBuffer = await fetchBinary(PROFILE_URL);
  const profile = parseProfile(profileBuffer);

  report(0.78, "warmup");
  const session = await createSession(ort, weights);

  // First run compiles the graph; do it now so the first real inspection is not slow.
  const warmup = new ort.Tensor("float32", new Float32Array(PIXEL_COUNT * 3), [
    1,
    3,
    IMAGE_SIZE,
    IMAGE_SIZE,
  ]);
  await session.run({ [INPUT_NAME]: warmup });

  report(1, "ready");
  return { session, profile };
}

/** Load the model once per page session; concurrent callers share the same promise. */
export function ensureModelLoaded(onProgress?: ProgressHandler): Promise<LoadedModel> {
  if (!modelPromise) {
    modelPromise = loadModel(onProgress).catch((error) => {
      modelPromise = null;
      throw error;
    });
  }
  return modelPromise;
}

/** Run the autoencoder and return the reconstruction as a CHW float tensor. */
export async function reconstruct(
  model: LoadedModel,
  inputTensor: Float32Array,
): Promise<Float32Array> {
  const ort = await loadRuntime();
  const input: Tensor = new ort.Tensor("float32", inputTensor, [1, 3, IMAGE_SIZE, IMAGE_SIZE]);
  const outputs = await model.session.run({ [INPUT_NAME]: input });

  const output = outputs[model.session.outputNames[0]];
  const data = output.data as Float32Array;
  if (data.length !== PIXEL_COUNT * 3) {
    throw new Error(`Unexpected model output length: ${data.length}`);
  }
  return data;
}
