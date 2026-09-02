/**
 * Ports of `cv2.cvtColor(RGB2GRAY)`, `cv2.threshold(..., THRESH_OTSU)` and
 * `cv2.connectedComponentsWithStats(..., connectivity=8)`.
 */

/** OpenCV's fixed-point luma coefficients (Q14). */
const R2Y = 4899;
const G2Y = 9617;
const B2Y = 1868;
const YUV_SHIFT = 14;
const YUV_ROUND = 1 << (YUV_SHIFT - 1);

const FLT_EPSILON = 1.1920928955078125e-7;

/** Convert interleaved RGB bytes to 8-bit luma, bit-identical to OpenCV. */
export function rgbToGray(rgb: ArrayLike<number>, pixelCount: number): Uint8Array {
  const gray = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i += 1) {
    const offset = i * 3;
    gray[i] =
      (rgb[offset] * R2Y + rgb[offset + 1] * G2Y + rgb[offset + 2] * B2Y + YUV_ROUND) >> YUV_SHIFT;
  }
  return gray;
}

/** Otsu's threshold over a 256-bin histogram, following OpenCV's `getThreshVal_Otsu_8u`. */
export function otsuThreshold(gray: Uint8Array): number {
  const histogram = new Float64Array(256);
  for (let i = 0; i < gray.length; i += 1) {
    histogram[gray[i]] += 1;
  }

  const scale = 1 / gray.length;
  let mu = 0;
  for (let i = 0; i < 256; i += 1) {
    mu += i * histogram[i];
  }
  mu *= scale;

  let mu1 = 0;
  let q1 = 0;
  let maxSigma = 0;
  let best = 0;

  for (let i = 0; i < 256; i += 1) {
    const p = histogram[i] * scale;
    mu1 *= q1;
    q1 += p;
    const q2 = 1 - q1;

    if (Math.min(q1, q2) < FLT_EPSILON || Math.max(q1, q2) > 1 - FLT_EPSILON) {
      continue;
    }

    mu1 = (mu1 + i * p) / q1;
    const mu2 = (mu - q1 * mu1) / q2;
    const sigma = q1 * q2 * (mu1 - mu2) * (mu1 - mu2);

    if (sigma > maxSigma) {
      maxSigma = sigma;
      best = i;
    }
  }

  return best;
}

/** `cv2.threshold(src, thresh, 255, THRESH_BINARY)` — strictly greater than the threshold. */
export function binarize(gray: Uint8Array, threshold: number): Uint8Array {
  const output = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i += 1) {
    output[i] = gray[i] > threshold ? 255 : 0;
  }
  return output;
}

export interface ComponentStats {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  centroidX: number;
  centroidY: number;
}

export interface ConnectedComponents {
  /** Number of labels including the background label 0. */
  count: number;
  /** Per-pixel label map. */
  labels: Int32Array;
  /** Stats indexed by label; index 0 is the background. */
  stats: ComponentStats[];
}

/**
 * Two-pass 8-connectivity labelling with union-find.
 *
 * Provisional labels are handed out in raster order and each set is represented by its
 * smallest provisional label, so final labels come out in raster order of each
 * component's first pixel — the same ordering OpenCV produces.
 */
export function connectedComponentsWithStats(
  binary: Uint8Array,
  width: number,
  height: number,
): ConnectedComponents {
  const size = width * height;
  const provisional = new Int32Array(size);
  // Worst case is one provisional label per two pixels on a checkerboard.
  const parent = new Int32Array((size >> 1) + 2);
  let nextLabel = 1;

  const find = (label: number): number => {
    let root = label;
    while (parent[root] !== root) root = parent[root];
    let current = label;
    while (parent[current] !== root) {
      const next = parent[current];
      parent[current] = root;
      current = next;
    }
    return root;
  };

  const union = (a: number, b: number): void => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA === rootB) return;
    if (rootA < rootB) parent[rootB] = rootA;
    else parent[rootA] = rootB;
  };

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    const previousRow = row - width;

    for (let x = 0; x < width; x += 1) {
      const index = row + x;
      if (binary[index] === 0) continue;

      let label = 0;

      // Neighbours already visited in raster order: NW, N, NE, W.
      if (y > 0) {
        if (x > 0 && provisional[previousRow + x - 1] !== 0) {
          label = provisional[previousRow + x - 1];
        }
        if (provisional[previousRow + x] !== 0) {
          const other = provisional[previousRow + x];
          label = label === 0 ? other : (union(label, other), label);
        }
        if (x + 1 < width && provisional[previousRow + x + 1] !== 0) {
          const other = provisional[previousRow + x + 1];
          label = label === 0 ? other : (union(label, other), label);
        }
      }
      if (x > 0 && provisional[index - 1] !== 0) {
        const other = provisional[index - 1];
        label = label === 0 ? other : (union(label, other), label);
      }

      if (label === 0) {
        label = nextLabel;
        parent[nextLabel] = nextLabel;
        nextLabel += 1;
      }

      provisional[index] = label;
    }
  }

  // Compact roots into final labels, preserving ascending provisional order.
  const finalLabel = new Int32Array(nextLabel);
  let count = 1;
  for (let label = 1; label < nextLabel; label += 1) {
    if (find(label) === label) {
      finalLabel[label] = count;
      count += 1;
    }
  }

  const stats: ComponentStats[] = [];
  const minX = new Int32Array(count).fill(width);
  const minY = new Int32Array(count).fill(height);
  const maxX = new Int32Array(count).fill(-1);
  const maxY = new Int32Array(count).fill(-1);
  const areas = new Int32Array(count);
  const sumX = new Float64Array(count);
  const sumY = new Float64Array(count);

  const labels = new Int32Array(size);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      const index = row + x;
      const provisionalLabel = provisional[index];
      if (provisionalLabel === 0) continue;

      const label = finalLabel[find(provisionalLabel)];
      labels[index] = label;

      if (x < minX[label]) minX[label] = x;
      if (y < minY[label]) minY[label] = y;
      if (x > maxX[label]) maxX[label] = x;
      if (y > maxY[label]) maxY[label] = y;
      areas[label] += 1;
      sumX[label] += x;
      sumY[label] += y;
    }
  }

  const backgroundArea = size - areas.reduce((total, value) => total + value, 0);
  stats.push({
    x: 0,
    y: 0,
    width,
    height,
    area: backgroundArea,
    centroidX: 0,
    centroidY: 0,
  });

  for (let label = 1; label < count; label += 1) {
    stats.push({
      x: minX[label],
      y: minY[label],
      width: maxX[label] - minX[label] + 1,
      height: maxY[label] - minY[label] + 1,
      area: areas[label],
      centroidX: sumX[label] / areas[label],
      centroidY: sumY[label] / areas[label],
    });
  }

  return { count, labels, stats };
}
