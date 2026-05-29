import { cn } from "@/lib/utils";

interface SummaryMetricProps {
  label: string;
  value: React.ReactNode;
  truncate?: boolean;
  title?: string;
  tone?: "default" | "ok" | "anomaly";
}

export function SummaryMetric({ label, value, truncate, title, tone = "default" }: SummaryMetricProps) {
  const stringValue = typeof value === "string" ? value : null;
  const toneClass =
    tone === "ok" ? "metric-value--ok" : tone === "anomaly" ? "metric-value--anomaly" : "";

  return (
    <div className="summary-metric min-w-0">
      <div className="metric-label">{label}</div>
      {truncate && stringValue ? (
        <div className={cn("metric-value truncate", toneClass)} title={title ?? stringValue}>
          {stringValue}
        </div>
      ) : (
        <div className={cn("metric-value", toneClass)}>{value}</div>
      )}
    </div>
  );
}
