import type { DashboardSeverity } from "@/types/inference";

/** Full-scale ratio mapped to the semicircular dial (needle clamps here). */
export const GAUGE_MAX_RATIO = 2;

export const GAUGE_THRESHOLD_RATIO = 1;

export const GAUGE_ZONE_BOUNDARIES = {
  green: 1.0,
  yellow: 1.25,
  orange: 1.75,
} as const;

export function deriveScoreRatio(
  anomalyScore: number | null | undefined,
  scoreThreshold: number | null | undefined,
): number | null {
  if (
    anomalyScore == null ||
    scoreThreshold == null ||
    !Number.isFinite(anomalyScore) ||
    !Number.isFinite(scoreThreshold) ||
    scoreThreshold <= 0
  ) {
    return null;
  }
  return anomalyScore / scoreThreshold;
}

export function deriveDashboardSeverityFromRatio(
  ratio: number | null | undefined,
): DashboardSeverity {
  if (ratio == null || !Number.isFinite(ratio)) return "Normal";
  if (ratio < GAUGE_ZONE_BOUNDARIES.green) return "Normal";
  if (ratio < GAUGE_ZONE_BOUNDARIES.yellow) return "Low";
  if (ratio < GAUGE_ZONE_BOUNDARIES.orange) return "Medium";
  return "High";
}

export function clampGaugeRatio(ratio: number | null | undefined): number {
  if (ratio == null || !Number.isFinite(ratio) || ratio < 0) return 0;
  return Math.min(ratio, GAUGE_MAX_RATIO);
}

/**
 * Map ratio → angle on the upper semicircle.
 * -π = far left (0×), -π/2 = top, 0 = far right (2×+).
 */
export function ratioToNeedleAngle(ratio: number): number {
  const clamped = clampGaugeRatio(ratio);
  return -Math.PI + (clamped / GAUGE_MAX_RATIO) * Math.PI;
}

export function polarOnGaugeArc(
  cx: number,
  cy: number,
  radius: number,
  ratio: number,
): { x: number; y: number } {
  const angle = ratioToNeedleAngle(ratio);
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

export function describeGaugeArcSegment(
  cx: number,
  cy: number,
  radius: number,
  ratioStart: number,
  ratioEnd: number,
): string {
  if (ratioEnd <= ratioStart) return "";

  const start = polarOnGaugeArc(cx, cy, radius, ratioStart);
  const end = polarOnGaugeArc(cx, cy, radius, ratioEnd);
  const angleSpan = ((ratioEnd - ratioStart) / GAUGE_MAX_RATIO) * Math.PI;
  const largeArc = angleSpan > Math.PI ? 1 : 0;

  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
}

export function gaugeZoneColor(ratio: number | null | undefined): string {
  const value = clampGaugeRatio(ratio ?? 0);
  if (value < GAUGE_THRESHOLD_RATIO) return "#7aaa5e";
  return "#e07a5f";
}
