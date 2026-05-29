import { cn } from "@/lib/utils";

interface MetricRowProps {
  label: string;
  value: React.ReactNode;
  className?: string;
  truncate?: boolean;
  title?: string;
}

export function MetricRow({ label, value, className, truncate, title }: MetricRowProps) {
  const stringValue = typeof value === "string" ? value : null;

  return (
    <div className={cn("summary-row flex items-center justify-between gap-2", className)}>
      <span className="summary-label shrink-0 text-lab-muted">{label}</span>
      {truncate && stringValue ? (
        <span
          className="summary-value truncate-value font-medium text-lab-text"
          title={title ?? stringValue}
        >
          {stringValue}
        </span>
      ) : (
        <span className="summary-value font-medium text-lab-text">{value}</span>
      )}
    </div>
  );
}
