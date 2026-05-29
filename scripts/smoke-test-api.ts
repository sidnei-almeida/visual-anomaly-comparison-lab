#!/usr/bin/env node
/**
 * Smoke test for POST /predict on the multi-product DAE API.
 *
 * Usage:
 *   npm run test:api
 *   NEXT_PUBLIC_ANOMALY_API_URL=http://localhost:8000 npm run test:api
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  DAE_Z_SCORE_THRESHOLDS,
  thresholdsMatchArtifact,
} from "../src/config/mvtec-dae-artifacts";

const ROOT = resolve(import.meta.dirname, "..");
const NORMAL_IMAGE = resolve(ROOT, "data/catalog/inspect-bottle-good-a.png");
const ANOMALY_IMAGE = resolve(ROOT, "data/catalog/inspect-bottle-broken-large.png");

loadEnvFile(resolve(ROOT, ".env.local"));
loadEnvFile(resolve(ROOT, ".env"));

const BASE_URL = (
  process.env.NEXT_PUBLIC_ANOMALY_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://salmeida-bottle-anomaly-detection.hf.space"
).replace(/\/$/, "");

type PredictPayload = Record<string, unknown>;

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function pass(message: string): void {
  console.log(`✓ ${message}`);
}

function warn(message: string): void {
  console.warn(`⚠ ${message}`);
}

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function assertNumber(value: unknown, label: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) fail(`${label} is not a finite number`);
  return n;
}

async function predict(imagePath: string, category: string): Promise<PredictPayload> {
  const buffer = readFileSync(imagePath);
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "image/png" }), "sample.png");
  form.append("category", category);
  form.append("include_images", "true");
  form.append("include_debug", "false");
  form.append("include_overlay", "false");

  const response = await fetch(`${BASE_URL}/predict`, { method: "POST", body: form });
  if (!response.ok) {
    const text = await response.text();
    fail(`POST /predict failed (${response.status}): ${text.slice(0, 200)}`);
  }
  return (await response.json()) as PredictPayload;
}

function assertPredictShape(payload: PredictPayload, label: string): void {
  if (typeof payload.is_anomaly !== "boolean") {
    fail(`${label}: is_anomaly missing`);
  }
  const scores = payload.scores as Record<string, unknown> | undefined;
  if (!scores) fail(`${label}: scores missing`);
  assertNumber(scores.anomaly_score, `${label}: scores.anomaly_score`);
  assertNumber(scores.threshold, `${label}: scores.threshold`);
  assertNumber(scores.error_mean, `${label}: scores.error_mean`);
  assertNumber(scores.z_map_max, `${label}: scores.z_map_max`);

  const imageSize = payload.image_size as Record<string, unknown> | undefined;
  if (!imageSize) fail(`${label}: image_size missing`);
  assertNumber(imageSize.width, `${label}: image_size.width`);
  assertNumber(imageSize.height, `${label}: image_size.height`);

  if (!Array.isArray(payload.boxes)) fail(`${label}: boxes must be an array`);

  const images = payload.images as Record<string, unknown> | undefined;
  if (images) {
    for (const key of ["original", "reconstruction", "heatmap", "mask"] as const) {
      const value = images[key];
      if (value != null && typeof value !== "string") {
        fail(`${label}: images.${key} must be a string data URL`);
      }
    }
  } else {
    warn(`${label}: images object missing (include_images may be false)`);
  }

  const model = payload.model as Record<string, unknown> | undefined;
  if (model?.experiment_name) {
    pass(`${label}: model.experiment_name=${model.experiment_name}`);
  }

  const category = String(payload.category ?? "bottle");
  const apiThr = Number((scores as Record<string, number>).threshold);
  const refThr = DAE_Z_SCORE_THRESHOLDS[category as keyof typeof DAE_Z_SCORE_THRESHOLDS];
  if (refThr != null) {
    const match = thresholdsMatchArtifact(apiThr, category);
    if (match === false) {
      warn(`${label}: API threshold ${apiThr} vs artifact ${refThr}`);
    } else {
      pass(`${label}: threshold matches artifact (${apiThr.toFixed(3)})`);
    }
  }

  pass(
    `${label}: status=${payload.status}, anomaly_score=${(scores as Record<string, number>).anomaly_score}, boxes=${(payload.boxes as unknown[]).length}`,
  );
}

async function main(): Promise<void> {
  if (!existsSync(NORMAL_IMAGE) || !existsSync(ANOMALY_IMAGE)) {
    fail(
      "Expected sample images under data/catalog/ (inspect-bottle-good-a.png, inspect-bottle-broken-large.png)",
    );
  }

  console.log(`API base URL: ${BASE_URL}`);

  const health = await fetch(`${BASE_URL}/health`);
  if (!health.ok) fail(`GET /health failed (${health.status})`);
  const healthJson = (await health.json()) as { status?: string };
  pass(`GET /health → ${healthJson.status ?? "ok"}`);

  const normal = await predict(NORMAL_IMAGE, "bottle");
  assertPredictShape(normal, "normal sample");

  const anomaly = await predict(ANOMALY_IMAGE, "bottle");
  assertPredictShape(anomaly, "anomaly sample");

  console.log("\nAll API smoke checks passed.");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
