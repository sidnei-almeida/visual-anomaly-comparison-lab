/**
 * Pillow-compatible bicubic resampling.
 *
 * The model thresholds were calibrated on images resized by `PIL.Image.resize`,
 * whose default filter is BICUBIC with antialiasing on downscale. Canvas scaling
 * uses a different, browser-dependent kernel, so a faithful port is required for
 * the anomaly scores computed here to match the ones from the training pipeline.
 *
 * Mirrors `Resample.c` from Pillow, including its fixed-point accumulation for
 * 8-bit images (22 fractional bits with round-half-up).
 */

const PRECISION_BITS = 22;
const PRECISION_SCALE = 1 << PRECISION_BITS;
const PRECISION_HALF = 1 << (PRECISION_BITS - 1);
const BICUBIC_SUPPORT = 2.0;
const BICUBIC_A = -0.5;

export interface RgbImage {
  width: number;
  height: number;
  /** Interleaved RGB, 3 bytes per pixel. */
  data: Uint8ClampedArray;
}

function bicubicFilter(value: number): number {
  const x = value < 0 ? -value : value;
  if (x < 1.0) {
    return ((BICUBIC_A + 2.0) * x - (BICUBIC_A + 3.0)) * x * x + 1;
  }
  if (x < 2.0) {
    return (((x - 5) * x + 8) * x - 4) * BICUBIC_A;
  }
  return 0.0;
}

interface Coefficients {
  /** Fixed-point weights, `kernelSize` per output pixel. */
  weights: Int32Array;
  /** First contributing input index per output pixel. */
  starts: Int32Array;
  /** Number of contributing input pixels per output pixel. */
  counts: Int32Array;
  kernelSize: number;
}

function computeCoefficients(inSize: number, outSize: number): Coefficients {
  const scale = inSize / outSize;
  const filterScale = scale < 1.0 ? 1.0 : scale;
  const support = BICUBIC_SUPPORT * filterScale;
  const kernelSize = Math.ceil(support) * 2 + 1;

  const weights = new Int32Array(outSize * kernelSize);
  const starts = new Int32Array(outSize);
  const counts = new Int32Array(outSize);
  const raw = new Float64Array(kernelSize);

  const invFilterScale = 1.0 / filterScale;

  for (let out = 0; out < outSize; out += 1) {
    const center = (out + 0.5) * scale;

    let start = Math.trunc(center - support + 0.5);
    if (start < 0) start = 0;

    let end = Math.trunc(center + support + 0.5);
    if (end > inSize) end = inSize;
    const count = end - start;

    let total = 0.0;
    for (let i = 0; i < count; i += 1) {
      const weight = bicubicFilter((i + start - center + 0.5) * invFilterScale);
      raw[i] = weight;
      total += weight;
    }

    const base = out * kernelSize;
    for (let i = 0; i < count; i += 1) {
      const normalized = total !== 0.0 ? raw[i] / total : raw[i];
      // Pillow rounds half away from zero when quantizing the kernel.
      weights[base + i] =
        normalized < 0
          ? -Math.round(-normalized * PRECISION_SCALE)
          : Math.round(normalized * PRECISION_SCALE);
    }

    starts[out] = start;
    counts[out] = count;
  }

  return { weights, starts, counts, kernelSize };
}

function clip8(accumulator: number): number {
  const value = Math.floor(accumulator / PRECISION_SCALE);
  if (value <= 0) return 0;
  if (value >= 255) return 255;
  return value;
}

function resampleHorizontal(source: RgbImage, outWidth: number): RgbImage {
  const { width, height, data } = source;
  const { weights, starts, counts, kernelSize } = computeCoefficients(width, outWidth);
  const out = new Uint8ClampedArray(outWidth * height * 3);

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * width * 3;
    const outRowOffset = y * outWidth * 3;

    for (let x = 0; x < outWidth; x += 1) {
      const base = x * kernelSize;
      const start = starts[x];
      const count = counts[x];

      let r = PRECISION_HALF;
      let g = PRECISION_HALF;
      let b = PRECISION_HALF;

      for (let i = 0; i < count; i += 1) {
        const weight = weights[base + i];
        const pixel = rowOffset + (start + i) * 3;
        r += data[pixel] * weight;
        g += data[pixel + 1] * weight;
        b += data[pixel + 2] * weight;
      }

      const target = outRowOffset + x * 3;
      out[target] = clip8(r);
      out[target + 1] = clip8(g);
      out[target + 2] = clip8(b);
    }
  }

  return { width: outWidth, height, data: out };
}

function resampleVertical(source: RgbImage, outHeight: number): RgbImage {
  const { width, height, data } = source;
  const { weights, starts, counts, kernelSize } = computeCoefficients(height, outHeight);
  const out = new Uint8ClampedArray(width * outHeight * 3);

  for (let y = 0; y < outHeight; y += 1) {
    const base = y * kernelSize;
    const start = starts[y];
    const count = counts[y];
    const outRowOffset = y * width * 3;

    for (let x = 0; x < width; x += 1) {
      let r = PRECISION_HALF;
      let g = PRECISION_HALF;
      let b = PRECISION_HALF;

      for (let i = 0; i < count; i += 1) {
        const weight = weights[base + i];
        const pixel = ((start + i) * width + x) * 3;
        r += data[pixel] * weight;
        g += data[pixel + 1] * weight;
        b += data[pixel + 2] * weight;
      }

      const target = outRowOffset + x * 3;
      out[target] = clip8(r);
      out[target + 1] = clip8(g);
      out[target + 2] = clip8(b);
    }
  }

  return { width, height: outHeight, data: out };
}

/** Resize an interleaved RGB image the way `PIL.Image.resize` does by default. */
export function resizeBicubic(source: RgbImage, outWidth: number, outHeight: number): RgbImage {
  if (source.width === outWidth && source.height === outHeight) {
    return { width: outWidth, height: outHeight, data: new Uint8ClampedArray(source.data) };
  }

  let current = source;
  if (source.width !== outWidth) {
    current = resampleHorizontal(current, outWidth);
  }
  if (current.height !== outHeight) {
    current = resampleVertical(current, outHeight);
  }
  return current;
}
