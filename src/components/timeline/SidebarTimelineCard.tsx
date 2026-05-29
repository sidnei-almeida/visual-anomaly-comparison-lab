"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { FullTimelineModal } from "@/components/timeline/FullTimelineModal";
import { TimelineList } from "@/components/timeline/TimelineList";
import { Panel } from "@/components/ui/Panel";
import { sortTimelineEntries } from "@/services/inspectionService";
import { useInspectionStore } from "@/store/inspection-store";

export const MAX_TIMELINE_ITEMS = 5;

export function SidebarTimelineCard() {
  const timeline = useInspectionStore((s) => s.timeline);
  const selectedSampleId = useInspectionStore((s) => s.selectedSampleId);
  const samples = useInspectionStore((s) => s.samples);
  const batchFailures = useInspectionStore((s) => s.batchFailures);
  const selectSample = useInspectionStore((s) => s.selectSample);
  const [isFullTimelineOpen, setIsFullTimelineOpen] = useState(false);

  const sorted = useMemo(() => sortTimelineEntries(timeline), [timeline]);
  const latestTimelineItems = useMemo(
    () => sorted.slice(-MAX_TIMELINE_ITEMS),
    [sorted],
  );

  return (
    <>
      <Panel className="summary-card sidebar-timeline-card timeline-card">
        <p className="summary-card-title">Timeline</p>

        <TimelineList
          entries={latestTimelineItems}
          samples={samples}
          selectedSampleId={selectedSampleId}
          onSelectSample={selectSample}
          compact
        />

        {sorted.length > MAX_TIMELINE_ITEMS && (
          <p className="timeline-count">
            Showing latest {MAX_TIMELINE_ITEMS} of {sorted.length} runs
            {batchFailures.length > 0 ? ` · ${batchFailures.length} failed` : ""}
          </p>
        )}

        {sorted.length > 0 && sorted.length <= MAX_TIMELINE_ITEMS && (
          <p className="timeline-count">
            {sorted.length} run{sorted.length === 1 ? "" : "s"}
            {batchFailures.length > 0 ? ` · ${batchFailures.length} failed` : ""}
          </p>
        )}

        <button
          type="button"
          className="summary-compact-btn summary-compact-btn--accent mt-2 w-full disabled:opacity-40"
          disabled={sorted.length === 0}
          onClick={() => setIsFullTimelineOpen(true)}
        >
          <ExternalLink className="h-3 w-3" />
          View full timeline
        </button>
      </Panel>

      <FullTimelineModal
        open={isFullTimelineOpen}
        onClose={() => setIsFullTimelineOpen(false)}
        entries={sorted}
        samples={samples}
        selectedSampleId={selectedSampleId}
        onSelectSample={selectSample}
        failedCount={batchFailures.length}
      />
    </>
  );
}
