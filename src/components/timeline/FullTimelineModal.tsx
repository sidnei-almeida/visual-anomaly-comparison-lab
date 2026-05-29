"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { InspectionSample, TimelineEntry } from "@/types/inspection";
import { TimelineList } from "@/components/timeline/TimelineList";

export interface FullTimelineModalProps {
  open: boolean;
  onClose: () => void;
  entries: TimelineEntry[];
  samples: InspectionSample[];
  selectedSampleId: string | null;
  onSelectSample: (sampleId: string) => void;
  failedCount?: number;
}

export function FullTimelineModal({
  open,
  onClose,
  entries,
  samples,
  selectedSampleId,
  onSelectSample,
  failedCount = 0,
}: FullTimelineModalProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleSelect = (sampleId: string) => {
    onSelectSample(sampleId);
    onClose();
  };

  return (
    <div
      className="full-timeline-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="full-timeline-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="full-timeline-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="full-timeline-modal__header">
          <div>
            <p id="full-timeline-title" className="full-timeline-modal__title">
              Full timeline
            </p>
            <p className="full-timeline-modal__subtitle">
              {entries.length} run{entries.length === 1 ? "" : "s"}
              {failedCount > 0 ? ` · ${failedCount} failed` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="full-timeline-modal__close"
            aria-label="Close full timeline"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="full-timeline-modal__body">
          <TimelineList
            entries={entries}
            samples={samples}
            selectedSampleId={selectedSampleId}
            onSelectSample={handleSelect}
          />
        </div>
      </div>
    </div>
  );
}
