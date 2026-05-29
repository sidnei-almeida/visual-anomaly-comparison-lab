"use client";

import type { InspectionResult, InspectionSample } from "@/types/inspection";
import { isSampleApiSupported, verdictKindToUiStatus } from "@/services/inspectionService";
import { StatusBadge, StatusDot } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";

interface SampleListItemProps {
  sample: InspectionSample;
  displayId: string;
  result?: InspectionResult;
  selected?: boolean;
  disabled?: boolean;
  index?: number;
  onSelect: () => void;
}

export function SampleListItem({
  sample,
  displayId,
  result,
  selected,
  disabled,
  index = 0,
  onSelect,
}: SampleListItemProps) {
  const unsupported = result?.isUnsupported || (!result && !isSampleApiSupported(sample));
  const status = unsupported
    ? "unsupported"
    : result
      ? verdictKindToUiStatus(result.verdictKind)
      : "review";
  const statusLabel = unsupported ? "Unsupported" : result ? undefined : "Pending";

  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        className={cn(
          "sample-navigator-item sample-item flex w-full items-center text-left disabled:opacity-50",
          selected && "sample-navigator-item--selected",
        )}
        style={{ ["--item-index" as string]: Math.min(index, 10) }}
      >
        <div className="sample-navigator-thumb relative shrink-0 overflow-hidden bg-[#1a1814]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sample.imageUrl} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="sample-navigator-title">{displayId}</span>
            {(result || !unsupported) && <StatusDot status={status} />}
          </div>
          {result ? (
            <StatusBadge status={status} className="sample-navigator-status mt-0.5" />
          ) : (
            <span className="sample-navigator-status mt-0.5 inline-block uppercase text-lab-pending">
              {statusLabel}
            </span>
          )}
          <p className="sample-navigator-meta truncate">{sample.name}</p>
        </div>
      </button>
    </li>
  );
}
