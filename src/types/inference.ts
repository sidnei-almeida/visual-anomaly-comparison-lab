/** Dashboard-only severity — not an official model label. */
export type DashboardSeverity = "Normal" | "Low" | "Medium" | "High";

export interface SessionMetrics {
  totalProcessed: number;
  normalCount: number;
  anomalyCount: number;
  anomalyRate: number;
  avgAnomalyScore: number | null;
  maxAnomalyScore: number | null;
  minAnomalyScore: number | null;
  avgErrorMean: number | null;
  avgLatencyMs: number | null;
  /** Latest score threshold from API (category-specific). */
  scoreThreshold: number | null;
  failedCount: number;
}
