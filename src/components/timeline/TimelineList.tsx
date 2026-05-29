"use client";

import type { InspectionSample, TimelineEntry } from "@/types/inspection";
import { SidebarTimelineRow } from "@/components/timeline/SidebarTimelineRow";
import { cn } from "@/lib/utils";

export interface TimelineListProps {
  entries: TimelineEntry[];
  samples: InspectionSample[];
  selectedSampleId: string | null;
  onSelectSample: (sampleId: string) => void;
  compact?: boolean;
}

export function TimelineList({
  entries,
  samples,
  selectedSampleId,
  onSelectSample,
  compact = false,
}: TimelineListProps) {
  if (entries.length === 0) {
    return <p className="text-[10px] leading-snug text-lab-muted">No inference runs yet.</p>;
  }

  return (
    <ul className={cn("sidebar-timeline-list", compact && "timeline-list--compact")}>
      {entries.map((entry) => {
        const sample = samples.find((s) => s.id === entry.sampleId);
        if (!sample) return null;
        return (
          <SidebarTimelineRow
            key={entry.id}
            entry={entry}
            sample={sample}
            selected={entry.sampleId === selectedSampleId}
            onSelect={() => onSelectSample(entry.sampleId)}
          />
        );
      })}
    </ul>
  );
}
