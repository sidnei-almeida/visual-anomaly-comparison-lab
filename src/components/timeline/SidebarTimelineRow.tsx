import { format } from "date-fns";
import type { TimelineEntry } from "@/types/inspection";
import type { InspectionSample } from "@/types/inspection";
import { formatTimelineLabel, verdictKindToUiStatus } from "@/services/inspectionService";
import { cn } from "@/lib/utils";

interface SidebarTimelineRowProps {
  entry: TimelineEntry;
  sample: InspectionSample;
  selected?: boolean;
  onSelect: () => void;
}

const statusLabel: Record<ReturnType<typeof verdictKindToUiStatus>, string> = {
  ok: "OK",
  anomaly: "ANOMALY",
  review: "PENDING",
  unsupported: "UNSUPPORTED",
};

const statusClass: Record<ReturnType<typeof verdictKindToUiStatus>, string> = {
  ok: "text-lab-ok",
  anomaly: "text-lab-anomaly",
  review: "text-lab-pending",
  unsupported: "text-lab-muted",
};

export function SidebarTimelineRow({
  entry,
  sample,
  selected,
  onSelect,
}: SidebarTimelineRowProps) {
  const uiStatus = verdictKindToUiStatus(entry.verdictKind);
  const timeLabel = format(new Date(entry.timestamp), "HH:mm:ss");
  const scoreLabel =
    entry.anomalyScore != null && Number.isFinite(entry.anomalyScore)
      ? entry.anomalyScore.toFixed(3)
      : "—";

  return (
    <li className="sidebar-timeline-row-wrap">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "sidebar-timeline-row w-full text-left",
          selected && "sidebar-timeline-row--selected",
        )}
      >
        <span className="sidebar-timeline-spine-dot hidden" aria-hidden />
        <span className="sidebar-timeline-time font-mono">{timeLabel}</span>
        <div className="sidebar-timeline-thumb overflow-hidden rounded border border-lab-border bg-[#0d0d0d]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sample.imageUrl} alt="" className="h-full w-full object-cover" />
        </div>
        <span className="sidebar-timeline-id font-mono">{formatTimelineLabel(entry)}</span>
        <span className="sidebar-timeline-score font-mono">{scoreLabel}</span>
        <span className={cn("sidebar-timeline-status", statusClass[uiStatus])}>
          {statusLabel[uiStatus]}
        </span>
      </button>
    </li>
  );
}
