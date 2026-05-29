import { cn } from "@/lib/utils";
import type { UiSampleStatus } from "@/services/inspectionService";

const badgeClass: Record<UiSampleStatus, string> = {
  ok: "status-badge--ok",
  anomaly: "status-badge--anomaly",
  review: "status-badge--pending",
  unsupported: "status-badge--unsupported",
};

const labels: Record<UiSampleStatus, string> = {
  ok: "OK",
  anomaly: "ANOMALY",
  review: "PENDING",
  unsupported: "UNSUPPORTED",
};

const dotClass: Record<UiSampleStatus, string> = {
  ok: "status-dot--ok",
  anomaly: "status-dot--anomaly",
  review: "status-dot--pending",
  unsupported: "status-dot--unsupported",
};

interface StatusBadgeProps {
  status: UiSampleStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn("status-badge", badgeClass[status], className)}>
      {labels[status]}
    </span>
  );
}

export function StatusDot({ status, className }: StatusBadgeProps) {
  return <span className={cn("status-dot", dotClass[status], className)} aria-hidden />;
}
