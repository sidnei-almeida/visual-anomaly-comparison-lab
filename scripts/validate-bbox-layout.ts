/**
 * Unit checks for bbox coordinate conversion.
 * Run: npx tsx scripts/validate-bbox-layout.ts
 */

import {
  boxToModelPixels,
  computeContainLayout,
  detectBboxFormat,
  modelBoxToNaturalBox,
  modelBoxToRenderedRect,
} from "../src/lib/bbox-layout";
import type { PredictBox } from "../src/types/predict-api";

function assertClose(actual: number, expected: number, label: string, eps = 0.01): void {
  if (Math.abs(actual - expected) > eps) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

const modelSize = { width: 256, height: 256 };
const bottleBox: PredictBox = { x: 133, y: 50, w: 29, h: 34 };
const hazelnutBox: PredictBox = { x: 81, y: 219, w: 12, h: 11 };

if (detectBboxFormat(bottleBox, modelSize) !== "pixel_xywh") {
  throw new Error("bottle box format should be pixel_xywh");
}

const normalized: PredictBox = { x: 0.5, y: 0.25, w: 0.1, h: 0.08 };
const normalizedPx = boxToModelPixels(normalized, modelSize);
assertClose(normalizedPx.x, 128, "normalized x");
assertClose(normalizedPx.y, 64, "normalized y");

const catalogNatural = { width: 1024, height: 1024 };
const scaled = modelBoxToNaturalBox(hazelnutBox, modelSize, catalogNatural);
assertClose(scaled.x, 324, "hazelnut scaled x");
assertClose(scaled.y, 876, "hazelnut scaled y");

const layout = computeContainLayout(256, 256, 320, 320);
if (!layout) throw new Error("layout should exist");
assertClose(layout.renderedWidth, 320, "square contain width");
assertClose(layout.offsetX, 0, "square contain offsetX");

const rect = modelBoxToRenderedRect(bottleBox, modelSize, { width: 256, height: 256 }, layout);
assertClose(rect.left, (133 / 256) * 320, "bottle rendered left");
assertClose(rect.top, (50 / 256) * 320, "bottle rendered top");

console.log("✓ bbox layout validation passed");
