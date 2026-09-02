#!/usr/bin/env node
/**
 * Parity test for the in-browser inference pipeline.
 *
 * Compares the TypeScript port against reference outputs captured from the original
 * Python service (`model_utils.predict`), so regressions in the resampler, the OpenCV
 * ports or the ONNX export are caught before they reach the UI.
 *
 * Generate the fixture first (needs the `anomaly_detection_unet` repo and a Python
 * environment with torch, torchvision, opencv and Pillow):
 *
 *   python scripts/make-parity-fixture.py <fixture-dir>
 *   FIXTURE_DIR=<fixture-dir> npm run test:parity
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ort from "onnxruntime-web";

import { resizeBicubic } from "../src/lib/cv/resize";
import { runPipeline, rgbToTensor, IMAGE_SIZE, PIXEL_COUNT } from "../src/lib/inference/pipeline";
import type { CategoryProfile } from "../src/lib/inference/pipeline";

const ROOT = resolve(import.meta.dirname, "..");
const FIXTURE_DIR = process.env.FIXTURE_DIR;

/** Scores are accumulated in float64 here and float32 in NumPy, so compare relatively. */
const RELATIVE_TOLERANCE = 1e-5;
const ABSOLUTE_TOLERANCE = 1e-6;
/**
 * The heatmap is the one output that amplifies float noise: the category profile has
 * standard deviations down to 1e-6, so the ~1e-6 gap between the ONNX and PyTorch
 * reconstructions can move a z-score by a few tenths in those pixels, shifting them a
 * couple of quantization levels. Scores, boxes and the localization mask are unaffected,
 * so allow a bounded per-byte drift here rather than demanding bit equality.
 */
const IMAGE_MISMATCH_TOLERANCE = 0.08;
const IMAGE_MAX_BYTE_DELTA = 16;

function closeEnough(actual: number, expected: number): boolean {
  return (
    Math.abs(actual - expected) <=
    Math.max(ABSOLUTE_TOLERANCE, Math.abs(expected) * RELATIVE_TOLERANCE)
  );
}

interface FixtureBox {
  x: number;
  y: number;
  w: number;
  h: number;
  area: number;
  mean_z: number;
  max_z: number;
  score: number;
  foreground_ratio: number;
}

interface FixtureEntry {
  n: number;
  file: string;
  native_width: number;
  native_height: number;
  status: string;
  is_anomaly: boolean;
  anomaly_score: number;
  threshold: number;
  error_mean: number;
  z_map_max: number;
  boxes: FixtureBox[];
}

let failures = 0;

function check(label: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`  ok    ${label}${detail ? ` ${detail}` : ""}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL  ${label}${detail ? ` ${detail}` : ""}`);
}

function readBinary(dir: string, name: string): Buffer {
  return readFileSync(resolve(dir, name));
}

interface ImageDiff {
  count: number;
  maxDelta: number;
  total: number;
}

function diffImages(actual: ArrayLike<number>, expected: ArrayLike<number>): ImageDiff {
  let count = 0;
  let maxDelta = 0;
  for (let i = 0; i < expected.length; i += 1) {
    const delta = Math.abs(actual[i] - expected[i]);
    if (delta > 0) {
      count += 1;
      if (delta > maxDelta) maxDelta = delta;
    }
  }
  return { count, maxDelta, total: expected.length };
}

function checkImage(label: string, diff: ImageDiff, exact = false): void {
  const ok = exact
    ? diff.count === 0
    : diff.count / diff.total <= IMAGE_MISMATCH_TOLERANCE && diff.maxDelta <= IMAGE_MAX_BYTE_DELTA;
  check(label, ok, `(${diff.count}/${diff.total} bytes differ, max delta ${diff.maxDelta})`);
}

function loadProfile(): CategoryProfile {
  const buffer = readBinary(resolve(ROOT, "public", "model"), "bottle-profile.bin");
  const values = new Float32Array(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  );
  return {
    mean: values.subarray(0, PIXEL_COUNT),
    std: values.subarray(PIXEL_COUNT, PIXEL_COUNT * 2),
  };
}

async function main(): Promise<void> {
  if (!FIXTURE_DIR) {
    console.error("Set FIXTURE_DIR to the directory produced by scripts/make-parity-fixture.py");
    process.exit(2);
  }

  const dir = resolve(FIXTURE_DIR);
  const index = JSON.parse(readFileSync(resolve(dir, "index.json"), "utf8")) as FixtureEntry[];

  ort.env.wasm.numThreads = 1;
  ort.env.logLevel = "error";
  const session = await ort.InferenceSession.create(resolve(ROOT, "public/model/dae-bottle.onnx"), {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });

  const profile = loadProfile();

  for (const entry of index) {
    console.log(`\n${entry.file}`);

    const native = readBinary(dir, `${entry.n}_native.bin`);
    const resized = resizeBicubic(
      {
        width: entry.native_width,
        height: entry.native_height,
        data: new Uint8ClampedArray(native),
      },
      IMAGE_SIZE,
      IMAGE_SIZE,
    );

    const expectedResized = readBinary(dir, `${entry.n}_resized.bin`);
    checkImage("resize matches PIL bicubic", diffImages(resized.data, expectedResized), true);

    const inputTensor = rgbToTensor(resized.data);
    const outputs = await session.run({
      image: new ort.Tensor("float32", inputTensor, [1, 3, IMAGE_SIZE, IMAGE_SIZE]),
    });
    const reconstruction = outputs[session.outputNames[0]].data as Float32Array;

    const expectedRecon = new Float32Array(
      readBinary(dir, `${entry.n}_recon.bin`).buffer.slice(0),
    );
    let maxReconDelta = 0;
    for (let i = 0; i < expectedRecon.length; i += 1) {
      const delta = Math.abs(reconstruction[i] - expectedRecon[i]);
      if (delta > maxReconDelta) maxReconDelta = delta;
    }
    check("reconstruction matches PyTorch", maxReconDelta < 1e-4, `(max delta ${maxReconDelta.toExponential(2)})`);

    const result = runPipeline(resized.data, inputTensor, reconstruction, profile, "bottle");

    check("status", result.status === entry.status, `(${result.status} vs ${entry.status})`);
    check(
      "anomaly_score",
      closeEnough(result.anomalyScore, entry.anomaly_score),
      `(${result.anomalyScore.toFixed(6)} vs ${entry.anomaly_score.toFixed(6)})`,
    );
    check(
      "error_mean",
      closeEnough(result.errorMean, entry.error_mean),
      `(${result.errorMean.toFixed(8)} vs ${entry.error_mean.toFixed(8)})`,
    );
    check(
      "z_map_max",
      closeEnough(result.zMapMax, entry.z_map_max),
      `(${result.zMapMax.toFixed(6)} vs ${entry.z_map_max.toFixed(6)})`,
    );

    check(
      "box count",
      result.boxes.length === entry.boxes.length,
      `(${result.boxes.length} vs ${entry.boxes.length})`,
    );

    const boxCount = Math.min(result.boxes.length, entry.boxes.length);
    for (let i = 0; i < boxCount; i += 1) {
      const actual = result.boxes[i];
      const expected = entry.boxes[i];
      const geometryMatches =
        actual.x === expected.x &&
        actual.y === expected.y &&
        actual.w === expected.w &&
        actual.h === expected.h &&
        actual.area === expected.area;
      check(
        `box ${i} geometry`,
        geometryMatches,
        `(${actual.x},${actual.y},${actual.w},${actual.h},${actual.area} vs ` +
          `${expected.x},${expected.y},${expected.w},${expected.h},${expected.area})`,
      );
      check(
        `box ${i} mean_z`,
        closeEnough(actual.mean_z, expected.mean_z),
        `(${actual.mean_z.toFixed(6)} vs ${expected.mean_z.toFixed(6)})`,
      );
    }

    checkImage(
      "localization mask",
      diffImages(result.maskGray, readBinary(dir, `${entry.n}_mask.bin`)),
      true,
    );
    checkImage("heatmap", diffImages(result.heatmapRgb, readBinary(dir, `${entry.n}_heatmap.bin`)));
    checkImage(
      "reconstruction image",
      diffImages(result.reconstructionRgb, readBinary(dir, `${entry.n}_reconimg.bin`)),
    );
  }

  console.log(
    failures === 0 ? "\nAll parity checks passed." : `\n${failures} parity check(s) failed.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
