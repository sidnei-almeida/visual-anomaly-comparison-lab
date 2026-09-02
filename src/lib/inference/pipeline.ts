/**
 * Browser port of `model_utils.predict` from the retired Hugging Face inference service.
 *
 * Every step mirrors the Python original — including OpenCV border handling, NumPy
 * percentile interpolation and uint8 truncation — because the category thresholds were
 * calibrated against that exact pipeline.
 */

import { DAE_BBOX_PARAMS, DAE_Z_SCORE_THRESHOLDS } from "@/config/mvtec-dae-artifacts";
import type { ApiCategory } from "@/config/api-categories";
import { applyJetColormap } from "@/lib/cv/colormap";
import { closeRect, dilateRect, gaussianBlur5 } from "@/lib/cv/filters";
import {
  binarize,
  connectedComponentsWithStats,
  otsuThreshold,
  rgbToGray,
} from "@/lib/cv/segmentation";
import { maxOf, mean, percentile, topPercentMean } from "@/lib/cv/stats";

export const IMAGE_SIZE = 256;
export const PIXEL_COUNT = IMAGE_SIZE * IMAGE_SIZE;
export const SCORE_NAME = "top_1_z_score";
export const BBOX_METHOD = "foreground_masked_conservative_connected_components_on_z_map";
export const SCORE_REGION = "full_z_map";
export const LOCALIZATION_REGION = "product_foreground";
export const LOCALIZATION_NOTE =
  "Bottle-only deployment. Classification uses top_1_z_score on the full " +
  "category-normalized z-map (compatible with existing thresholds). Bounding boxes " +
  "and mask use the estimated product foreground only. Boxes are approximate visual hints.";

const PRODUCT_MASK_MIN_AREA_RATIO = 0.03;
const PRODUCT_MASK_MAX_AREA_RATIO = 0.85;
const BOX_MIN_FOREGROUND_RATIO = 0.25;
const BOX_BORDER_FOREGROUND_RATIO = 0.4;
const BOX_BORDER_MARGIN = 3;
const PRODUCT_MASK_CLOSE_KERNEL = 7;
const PRODUCT_MASK_DILATE_KERNEL = 5;
const HEATMAP_PERCENTILE = 99.5;
const STD_FLOOR = 1e-8;

export interface CategoryProfile {
  mean: Float32Array;
  std: Float32Array;
}

export interface PipelineBox {
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

export interface PipelineResult {
  status: "normal" | "anomaly";
  isAnomaly: boolean;
  anomalyScore: number;
  threshold: number;
  errorMean: number;
  zMapMax: number;
  boxes: PipelineBox[];
  /** Interleaved RGB planes at 256x256, ready to be encoded as PNG. */
  originalRgb: Uint8ClampedArray;
  reconstructionRgb: Uint8ClampedArray;
  heatmapRgb: Uint8ClampedArray;
  /** Single-channel localization mask, 0 or 255. */
  maskGray: Uint8Array;
}

/** Mean absolute error per pixel across the RGB channels. */
function computeErrorMap(input: Float32Array, reconstruction: Float32Array): Float32Array {
  const errorMap = new Float32Array(PIXEL_COUNT);
  const green = PIXEL_COUNT;
  const blue = PIXEL_COUNT * 2;

  for (let i = 0; i < PIXEL_COUNT; i += 1) {
    const dr = Math.abs(input[i] - reconstruction[i]);
    const dg = Math.abs(input[green + i] - reconstruction[green + i]);
    const db = Math.abs(input[blue + i] - reconstruction[blue + i]);
    errorMap[i] = (dr + dg + db) / 3;
  }

  return errorMap;
}

/** Category-normalized, clipped and smoothed z-error map. */
function computeZMap(errorMap: Float32Array, profile: CategoryProfile): Float32Array {
  const normalized = new Float32Array(PIXEL_COUNT);
  for (let i = 0; i < PIXEL_COUNT; i += 1) {
    const safeStd = Math.max(profile.std[i], STD_FLOOR);
    const z = (errorMap[i] - profile.mean[i]) / safeStd;
    normalized[i] = z > 0 ? z : 0;
  }
  return gaussianBlur5(normalized, IMAGE_SIZE, IMAGE_SIZE);
}

/**
 * Estimate a binary product/foreground mask: Otsu on luma, pick the polarity whose
 * largest component is central and plausibly sized, then close and dilate it.
 */
function computeProductMask(rgb: Uint8ClampedArray): Float32Array {
  const gray = rgbToGray(rgb, PIXEL_COUNT);
  const otsu = binarize(gray, otsuThreshold(gray));

  const inverted = new Uint8Array(PIXEL_COUNT);
  for (let i = 0; i < PIXEL_COUNT; i += 1) inverted[i] = 255 - otsu[i];

  const centerX = IMAGE_SIZE / 2;
  const centerY = IMAGE_SIZE / 2;
  const maxCenterDistance = Math.hypot(centerX, centerY) || 1;

  let bestComponent: Uint8Array | null = null;
  let bestScore = -1;

  for (const candidate of [otsu, inverted]) {
    const { count, labels, stats } = connectedComponentsWithStats(
      candidate,
      IMAGE_SIZE,
      IMAGE_SIZE,
    );
    if (count <= 1) continue;

    let largest = 1;
    for (let label = 2; label < count; label += 1) {
      if (stats[label].area > stats[largest].area) largest = label;
    }

    const component = stats[largest];
    const areaRatio = component.area / PIXEL_COUNT;
    const centerDistance = Math.hypot(component.centroidX - centerX, component.centroidY - centerY);
    const centrality = 1 - Math.min(centerDistance / maxCenterDistance, 1);

    const areaPlausible =
      areaRatio >= PRODUCT_MASK_MIN_AREA_RATIO && areaRatio <= PRODUCT_MASK_MAX_AREA_RATIO;
    const areaScore = areaPlausible ? 1 : Math.max(0, 1 - Math.abs(areaRatio - 0.35));
    const score = areaScore * 0.55 + centrality * 0.45;

    if (score > bestScore) {
      bestScore = score;
      const selected = new Uint8Array(PIXEL_COUNT);
      for (let i = 0; i < PIXEL_COUNT; i += 1) {
        selected[i] = labels[i] === largest ? 255 : 0;
      }
      bestComponent = selected;
    }
  }

  if (bestComponent === null) {
    bestComponent = new Uint8Array(PIXEL_COUNT).fill(255);
  }

  const closed = closeRect(bestComponent, IMAGE_SIZE, IMAGE_SIZE, PRODUCT_MASK_CLOSE_KERNEL);
  const dilated = dilateRect(closed, IMAGE_SIZE, IMAGE_SIZE, PRODUCT_MASK_DILATE_KERNEL, 1);

  const mask = new Float32Array(PIXEL_COUNT);
  for (let i = 0; i < PIXEL_COUNT; i += 1) mask[i] = dilated[i] > 0 ? 1 : 0;
  return mask;
}

function boxForegroundRatio(
  productMask: Float32Array,
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  if (w <= 0 || h <= 0) return 0;
  let total = 0;
  for (let row = y; row < y + h; row += 1) {
    const offset = row * IMAGE_SIZE;
    for (let column = x; column < x + w; column += 1) {
      total += productMask[offset + column];
    }
  }
  return total / (w * h);
}

function boxTouchesBorder(x: number, y: number, w: number, h: number): boolean {
  return (
    x < BOX_BORDER_MARGIN ||
    y < BOX_BORDER_MARGIN ||
    x + w > IMAGE_SIZE - BOX_BORDER_MARGIN ||
    y + h > IMAGE_SIZE - BOX_BORDER_MARGIN
  );
}

function passesForegroundFilter(
  productMask: Float32Array,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  const ratio = boxForegroundRatio(productMask, x, y, w, h);
  if (ratio < BOX_MIN_FOREGROUND_RATIO) return false;
  if (boxTouchesBorder(x, y, w, h) && ratio < BOX_BORDER_FOREGROUND_RATIO) return false;
  return true;
}

/** Binary mask from the z-map using the bbox visualization percentiles. */
function buildLocalizationMask(zMapForBoxes: Float32Array): Uint8Array {
  // NumPy keeps the input dtype, so the percentile of a float32 map is itself float32.
  const threshold = Math.fround(percentile(zMapForBoxes, DAE_BBOX_PARAMS.low_percentile));

  const mask = new Uint8Array(PIXEL_COUNT);
  for (let i = 0; i < PIXEL_COUNT; i += 1) {
    mask[i] = zMapForBoxes[i] >= threshold ? 255 : 0;
  }

  const iterations = DAE_BBOX_PARAMS.dilate_iterations ?? 0;
  if (iterations > 0) {
    return dilateRect(mask, IMAGE_SIZE, IMAGE_SIZE, DAE_BBOX_PARAMS.kernel_size ?? 3, iterations);
  }
  return mask;
}

function extractBoxes(
  zMapForBoxes: Float32Array,
  mask: Uint8Array,
  productMask: Float32Array,
): PipelineBox[] {
  const minArea = DAE_BBOX_PARAMS.min_area;
  const maxArea = PIXEL_COUNT * DAE_BBOX_PARAMS.max_area_ratio;
  const minMeanZ = DAE_BBOX_PARAMS.min_mean_z;
  const maxBoxes = DAE_BBOX_PARAMS.max_boxes;

  const { count, stats } = connectedComponentsWithStats(mask, IMAGE_SIZE, IMAGE_SIZE);
  const candidates: PipelineBox[] = [];

  for (let label = 1; label < count; label += 1) {
    const { x, y, width: w, height: h, area } = stats[label];
    if (area < minArea || area > maxArea || w === 0 || h === 0) continue;
    if (!passesForegroundFilter(productMask, x, y, w, h)) continue;

    let total = 0;
    let peak = -Infinity;
    for (let row = y; row < y + h; row += 1) {
      const offset = row * IMAGE_SIZE;
      for (let column = x; column < x + w; column += 1) {
        const value = zMapForBoxes[offset + column];
        total += value;
        if (value > peak) peak = value;
      }
    }

    const meanZ = total / (w * h);
    if (meanZ < minMeanZ) continue;

    candidates.push({
      x,
      y,
      w,
      h,
      area,
      mean_z: meanZ,
      max_z: peak,
      score: meanZ,
      foreground_ratio: boxForegroundRatio(productMask, x, y, w, h),
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, maxBoxes);
}

/** Normalize the z-map into an 8-bit plane for the JET heatmap. */
function normalizeHeatmap(zMap: Float32Array): Uint8Array {
  const positive: number[] = [];
  for (let i = 0; i < zMap.length; i += 1) {
    if (zMap[i] > 0) positive.push(zMap[i]);
  }
  if (positive.length === 0) return new Uint8Array(PIXEL_COUNT);

  // The z-map is float32, so NumPy computes the percentile and the scaling in float32.
  const high = Math.fround(percentile(positive, HEATMAP_PERCENTILE));
  if (high <= 0) return new Uint8Array(PIXEL_COUNT);

  const output = new Uint8Array(PIXEL_COUNT);
  for (let i = 0; i < PIXEL_COUNT; i += 1) {
    const ratio = Math.fround(zMap[i] / high);
    const normalized = Math.min(Math.max(ratio, 0), 1);
    // NumPy's astype(uint8) truncates rather than rounds.
    output[i] = Math.trunc(Math.fround(normalized * 255));
  }
  return output;
}

/** Convert a CHW float tensor in [0, 1] to interleaved RGB bytes. */
function tensorToRgb(tensor: Float32Array): Uint8ClampedArray {
  const rgb = new Uint8ClampedArray(PIXEL_COUNT * 3);
  const green = PIXEL_COUNT;
  const blue = PIXEL_COUNT * 2;

  for (let i = 0; i < PIXEL_COUNT; i += 1) {
    const target = i * 3;
    rgb[target] = Math.trunc(Math.min(Math.max(tensor[i], 0), 1) * 255);
    rgb[target + 1] = Math.trunc(Math.min(Math.max(tensor[green + i], 0), 1) * 255);
    rgb[target + 2] = Math.trunc(Math.min(Math.max(tensor[blue + i], 0), 1) * 255);
  }

  return rgb;
}

/** Convert a 256x256 RGB image to the CHW float tensor the ONNX graph expects. */
export function rgbToTensor(rgb: Uint8ClampedArray): Float32Array {
  const tensor = new Float32Array(PIXEL_COUNT * 3);
  const green = PIXEL_COUNT;
  const blue = PIXEL_COUNT * 2;

  for (let i = 0; i < PIXEL_COUNT; i += 1) {
    const source = i * 3;
    tensor[i] = rgb[source] / 255;
    tensor[green + i] = rgb[source + 1] / 255;
    tensor[blue + i] = rgb[source + 2] / 255;
  }

  return tensor;
}

/**
 * Run scoring, localization and visualization on a reconstructed image.
 *
 * `inputTensor` and `reconstruction` are CHW float tensors in [0, 1]; `rgb` is the same
 * input as interleaved bytes, reused for the foreground mask and the returned original.
 */
export function runPipeline(
  rgb: Uint8ClampedArray,
  inputTensor: Float32Array,
  reconstruction: Float32Array,
  profile: CategoryProfile,
  category: ApiCategory,
): PipelineResult {
  const errorMap = computeErrorMap(inputTensor, reconstruction);
  const zMap = computeZMap(errorMap, profile);

  // Classification uses the full z-map: the thresholds were calibrated on that region.
  const anomalyScore = topPercentMean(zMap, 1.0);
  const threshold = DAE_Z_SCORE_THRESHOLDS[category];
  const isAnomaly = anomalyScore > threshold;

  // Localization is restricted to the estimated product foreground.
  const productMask = computeProductMask(rgb);
  const zMapForBoxes = new Float32Array(PIXEL_COUNT);
  for (let i = 0; i < PIXEL_COUNT; i += 1) {
    zMapForBoxes[i] = zMap[i] * productMask[i];
  }

  const mask = buildLocalizationMask(zMapForBoxes);
  const boxes = extractBoxes(zMapForBoxes, mask, productMask);

  return {
    status: isAnomaly ? "anomaly" : "normal",
    isAnomaly,
    anomalyScore,
    threshold,
    errorMean: mean(errorMap),
    zMapMax: maxOf(zMap),
    boxes,
    originalRgb: new Uint8ClampedArray(rgb),
    reconstructionRgb: tensorToRgb(reconstruction),
    heatmapRgb: applyJetColormap(normalizeHeatmap(zMap)),
    maskGray: mask,
  };
}
