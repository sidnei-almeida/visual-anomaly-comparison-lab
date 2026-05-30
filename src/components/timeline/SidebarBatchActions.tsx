"use client";

import { Play, RotateCcw, Square } from "lucide-react";
import { isApiReady } from "@/services/inspectionService";
import { getPendingSamples, useInspectionStore } from "@/store/inspection-store";
import { cn } from "@/lib/utils";

interface SidebarBatchActionsProps {
  onStartPending: () => void;
  onReprocessAll: () => void;
  onStopLine: () => void;
}

export function SidebarBatchActions({
  onStartPending,
  onReprocessAll,
  onStopLine,
}: SidebarBatchActionsProps) {
  const samples = useInspectionStore((s) => s.samples);
  const resultsBySampleId = useInspectionStore((s) => s.resultsBySampleId);
  const isLineRunning = useInspectionStore((s) => s.isLineRunning);
  const apiHealth = useInspectionStore((s) => s.apiHealth);
  const batchFailures = useInspectionStore((s) => s.batchFailures);

  const apiReady = isApiReady(apiHealth);
  const pendingCount = getPendingSamples(samples, resultsBySampleId).length;
  const issueCount = batchFailures.length;

  return (
    <>
      {issueCount > 0 ? (
        <div className="issues-chip">
          <span className="issues-chip__dot" aria-hidden />
          {issueCount} Issue{issueCount === 1 ? "" : "s"}
        </div>
      ) : (
        <span className="text-[9px] text-lab-muted" aria-hidden />
      )}

      <div className="sidebar-batch-actions">
        {isLineRunning ? (
          <button type="button" onClick={onStopLine} className="batch-btn batch-btn--stop">
            <Square className="h-3 w-3 fill-current" />
            Stop
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onStartPending}
              disabled={!apiReady || pendingCount === 0}
              className="batch-btn batch-btn--pending"
              title={
                pendingCount === 0
                  ? "All samples already inspected"
                  : `Run ${pendingCount} pending sample(s)`
              }
            >
              <Play className="h-3 w-3 fill-current" />
              Pending
            </button>
            <button
              type="button"
              onClick={onReprocessAll}
              disabled={!apiReady || samples.length === 0}
              className="batch-btn batch-btn--ghost"
              title="Re-run inference for every catalog sample"
            >
              <RotateCcw className="h-3 w-3" />
              Reprocess
            </button>
          </>
        )}
        <span
          className={cn(
            "batch-btn batch-btn--ready pointer-events-none",
            !apiReady && "opacity-70",
          )}
        >
          {apiReady ? "Ready" : apiHealth?.rawStatus === "loading" ? "Loading" : "Offline"}
        </span>
      </div>
    </>
  );
}
