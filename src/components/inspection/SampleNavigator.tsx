"use client";

import { Filter, Upload } from "lucide-react";
import { useRef } from "react";
import { CategorySelector } from "@/components/inspection/CategorySelector";
import { SampleListItem } from "@/components/inspection/SampleListItem";
import { getSampleDisplayId } from "@/services/inspectionService";
import { useInspectionStore } from "@/store/inspection-store";

interface SampleNavigatorProps {
  onSelectSample: (sampleId: string) => void;
  onUploadFiles?: (files: FileList) => void;
}

export function SampleNavigator({ onSelectSample, onUploadFiles }: SampleNavigatorProps) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const samples = useInspectionStore((s) => s.samples);
  const selectedSampleId = useInspectionStore((s) => s.selectedSampleId);
  const resultsBySampleId = useInspectionStore((s) => s.resultsBySampleId);
  const timeline = useInspectionStore((s) => s.timeline);
  const isInspecting = useInspectionStore((s) => s.isInspecting);

  const inspectedCount = Object.keys(resultsBySampleId).length;

  if (!samples.length) {
    return (
      <aside className="lab-sidebar-left flex shrink-0 flex-col p-3 text-[10px] text-lab-muted">
        No curated samples found in catalog.
      </aside>
    );
  }

  return (
    <aside className="lab-sidebar-left flex shrink-0 flex-col">
      <CategorySelector />

      <div className="border-b border-lab-border px-2.5 py-2">
        <div className="flex items-center justify-between">
          <p className="section-label">Sample navigator</p>
          <span className="font-mono text-[8px] text-lab-muted">
            {inspectedCount} / {samples.length}
          </span>
        </div>
      </div>

      <div className="lab-sidebar-scroll min-h-0 flex-1 overflow-y-auto p-1.5">
        <ul className="space-y-0.5">
          {samples.map((sample, index) => (
            <SampleListItem
              key={sample.id}
              sample={sample}
              displayId={getSampleDisplayId(sample, index)}
              result={resultsBySampleId[sample.id]}
              selected={sample.id === selectedSampleId}
              disabled={isInspecting}
              index={index}
              onSelect={() => onSelectSample(sample.id)}
            />
          ))}
        </ul>
      </div>

      <div className="space-y-1 border-t border-lab-border p-1.5">
        <input
          ref={uploadRef}
          type="file"
          accept="image/png,image/jpeg"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files?.length && onUploadFiles) {
              onUploadFiles(event.target.files);
              event.target.value = "";
            }
          }}
        />
        <button
          type="button"
          onClick={() => uploadRef.current?.click()}
          disabled={!onUploadFiles || isInspecting}
          className="summary-compact-btn w-full disabled:opacity-40"
        >
          <Upload className="h-3 w-3" />
          Upload batch
        </button>
        <button type="button" className="summary-compact-btn w-full">
          <Filter className="h-3 w-3" />
          {timeline.length} runs logged
        </button>
      </div>
    </aside>
  );
}
