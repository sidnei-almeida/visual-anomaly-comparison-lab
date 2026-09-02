/** NumPy-compatible reductions used by the anomaly scoring pipeline. */

/**
 * `np.percentile(values, q)` with the default linear interpolation method.
 * The input array is not modified.
 */
export function percentile(values: ArrayLike<number>, q: number): number {
  if (values.length === 0) return 0;

  const sorted = Float64Array.from(values as ArrayLike<number>).sort();
  const position = (q / 100) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);

  if (lower === upper) return sorted[lower];
  return sorted[lower] + (position - lower) * (sorted[upper] - sorted[lower]);
}

/**
 * Mean of the highest `topPercent` fraction of the map — the `top_1_z_score` used for
 * classification. Mirrors `compute_topk_score` in the Python model utilities.
 */
export function topPercentMean(values: ArrayLike<number>, topPercent: number): number {
  const length = values.length;
  if (length === 0) return 0;

  const fraction = Math.max(topPercent, 0) / 100;
  const topK = Math.max(1, Math.ceil(length * fraction));

  const sorted = Float64Array.from(values as ArrayLike<number>).sort();
  let total = 0;
  for (let i = length - topK; i < length; i += 1) {
    total += sorted[i];
  }
  return total / topK;
}

export function mean(values: ArrayLike<number>): number {
  let total = 0;
  for (let i = 0; i < values.length; i += 1) total += values[i];
  return values.length === 0 ? 0 : total / values.length;
}

export function maxOf(values: ArrayLike<number>): number {
  let best = -Infinity;
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] > best) best = values[i];
  }
  return best;
}
