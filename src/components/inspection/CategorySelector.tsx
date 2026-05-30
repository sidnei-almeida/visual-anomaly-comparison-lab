"use client";

import { API_CATEGORY_LABELS, DEMO_API_CATEGORY } from "@/config/api-categories";
import { formatCategoryThreshold } from "@/config/mvtec-dae-artifacts";
import { useInspectionStore } from "@/store/inspection-store";

export function CategorySelector() {
  const isInspecting = useInspectionStore((s) => s.isInspecting);
  const isLineRunning = useInspectionStore((s) => s.isLineRunning);

  return (
    <div className="border-b border-lab-border px-2.5 py-2">
      <p className="section-label mb-1.5">API category</p>
      <p className="category-pill">
        {API_CATEGORY_LABELS[DEMO_API_CATEGORY]} · thr{" "}
        {formatCategoryThreshold(DEMO_API_CATEGORY)}
      </p>
      <p className="mt-1.5 text-[9px] italic leading-relaxed text-[#444444]">
        Demo focused on MVTec AD bottle samples.
        {(isInspecting || isLineRunning) && (
          <span className="block text-lab-muted/80">Inspection in progress…</span>
        )}
      </p>
    </div>
  );
}
