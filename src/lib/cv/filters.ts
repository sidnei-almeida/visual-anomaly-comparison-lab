/**
 * Ports of the OpenCV filtering calls used by the original Python inference code:
 * `cv2.GaussianBlur`, `cv2.dilate`, `cv2.erode` and `cv2.morphologyEx(MORPH_CLOSE)`.
 *
 * Border handling matches OpenCV's defaults — BORDER_REFLECT_101 for the blur, and
 * "out-of-image pixels do not contribute" for the morphology operations (OpenCV's
 * `morphologyDefaultBorderValue`).
 */

/**
 * OpenCV's hardcoded 5-tap kernel for `getGaussianKernel(5, 0)`.
 * Used whenever sigma is non-positive and ksize is small, which is the case here.
 */
const GAUSSIAN_5 = [0.0625, 0.25, 0.375, 0.25, 0.0625];
const GAUSSIAN_RADIUS = 2;

/** BORDER_REFLECT_101 index mapping: `gfedcb|abcdefgh|gfedcba`. */
function reflect101(index: number, size: number): number {
  if (size === 1) return 0;
  let i = index;
  while (i < 0 || i >= size) {
    if (i < 0) i = -i;
    if (i >= size) i = 2 * size - 2 - i;
  }
  return i;
}

/** Separable 5x5 Gaussian blur on a float32 plane, equivalent to `cv2.GaussianBlur(src, (5, 5), 0)`. */
export function gaussianBlur5(
  source: Float32Array,
  width: number,
  height: number,
): Float32Array {
  const horizontal = new Float32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -GAUSSIAN_RADIUS; k <= GAUSSIAN_RADIUS; k += 1) {
        sum += source[row + reflect101(x + k, width)] * GAUSSIAN_5[k + GAUSSIAN_RADIUS];
      }
      horizontal[row + x] = sum;
    }
  }

  const output = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -GAUSSIAN_RADIUS; k <= GAUSSIAN_RADIUS; k += 1) {
        sum += horizontal[reflect101(y + k, height) * width + x] * GAUSSIAN_5[k + GAUSSIAN_RADIUS];
      }
      output[row + x] = sum;
    }
  }

  return output;
}

type MorphOp = "dilate" | "erode";

/**
 * Rectangular-kernel morphology. Rect elements are separable, so this runs a 1-D pass
 * per axis. Pixels outside the image are skipped, matching OpenCV's default border value.
 */
function morphRect(
  source: Uint8Array,
  width: number,
  height: number,
  kernelSize: number,
  op: MorphOp,
): Uint8Array {
  const radius = (kernelSize - 1) >> 1;
  const isDilate = op === "dilate";
  const horizontal = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      const from = Math.max(0, x - radius);
      const to = Math.min(width - 1, x + radius);
      let best = source[row + from];
      for (let i = from + 1; i <= to; i += 1) {
        const value = source[row + i];
        if (isDilate ? value > best : value < best) best = value;
      }
      horizontal[row + x] = best;
    }
  }

  const output = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const from = Math.max(0, y - radius);
    const to = Math.min(height - 1, y + radius);
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      let best = horizontal[from * width + x];
      for (let i = from + 1; i <= to; i += 1) {
        const value = horizontal[i * width + x];
        if (isDilate ? value > best : value < best) best = value;
      }
      output[row + x] = best;
    }
  }

  return output;
}

export function dilateRect(
  source: Uint8Array,
  width: number,
  height: number,
  kernelSize: number,
  iterations = 1,
): Uint8Array {
  let current = source;
  for (let i = 0; i < iterations; i += 1) {
    current = morphRect(current, width, height, kernelSize, "dilate");
  }
  return current === source ? new Uint8Array(source) : current;
}

/** `cv2.morphologyEx(src, MORPH_CLOSE, ones(kernelSize))` — dilate followed by erode. */
export function closeRect(
  source: Uint8Array,
  width: number,
  height: number,
  kernelSize: number,
): Uint8Array {
  const dilated = morphRect(source, width, height, kernelSize, "dilate");
  return morphRect(dilated, width, height, kernelSize, "erode");
}
