"use client";

import { useEffect, useRef, useState } from "react";
import {
  getComparisonLabRegionNote,
  getOriginalPanelRegionCaption,
  shouldRenderPredictBoxes,
} from "@/lib/inspection-display";
import { resolveOriginalImageForBoxes } from "@/lib/bbox-layout";
import { InspectionImagePanel } from "@/components/viewer/InspectionImagePanel";
import { useInspectionStore, useSelectedSample } from "@/store/inspection-store";
import { cn } from "@/lib/utils";

export function ComparisonLab() {
  const sample = useSelectedSample();
  const currentResult = useInspectionStore((s) => s.currentResult);
  const isInspecting = useInspectionStore((s) => s.isInspecting);
  const [gridSwitching, setGridSwitching] = useState(false);
  const prevSampleIdRef = useRef<string | null>(null);

  const panelAnimationKey = `${sample?.id ?? "none"}-${currentResult?.timestamp ?? "pending"}`;

  useEffect(() => {
    if (!sample?.id) return;

    if (prevSampleIdRef.current == null) {
      prevSampleIdRef.current = sample.id;
      return;
    }

    if (prevSampleIdRef.current === sample.id) return;

    prevSampleIdRef.current = sample.id;
    setGridSwitching(true);
    const timer = window.setTimeout(() => setGridSwitching(false), 180);
    return () => window.clearTimeout(timer);
  }, [sample?.id]);

  if (!sample) {
    return (
      <section className="center-panel flex min-h-0 min-w-0 flex-1 items-center justify-center p-4 text-[11px] text-lab-muted">
        Select a bottle sample to run anomaly inspection.
      </section>
    );
  }

  const images = currentResult?.images;
  const imageSize = currentResult?.imageSize ?? { width: 256, height: 256 };
  const shouldShowBoxes = shouldRenderPredictBoxes(currentResult);
  const boxesForRender = shouldShowBoxes ? (currentResult?.boxes ?? []) : [];
  const originalSrc = resolveOriginalImageForBoxes(
    images?.original,
    sample.imageUrl,
    shouldShowBoxes,
  );

  return (
    <section className="center-panel relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <p className="shrink-0 truncate px-2 py-1 text-center text-[9px] leading-snug text-lab-muted">
        {getComparisonLabRegionNote(currentResult)}
      </p>

      <div className="comparison-lab-grid-wrap px-0 pb-0">
        <div className="results-main">
          <div
            key={panelAnimationKey}
            className={cn(
              "result-images-grid panels-grid",
              gridSwitching && "panels-grid--switching",
            )}
          >
            <InspectionImagePanel
              title="ORIGINAL"
              imageType="original"
              imageSrc={originalSrc}
              imageSize={imageSize}
              boxes={boxesForRender}
              showBoxes={shouldShowBoxes}
              badgeLabel={getOriginalPanelRegionCaption(currentResult)}
              debugCategory={currentResult?.apiCategory}
              emptyMessage="Original image not returned. Enable include_images=true on the API."
              isAnalyzing={isInspecting}
            />

            <InspectionImagePanel
              title="RECONSTRUCTION"
              imageType="reconstruction"
              imageSrc={images?.reconstruction}
              imageSize={imageSize}
              badgeLabel="Autoencoder reconstruction"
              highlighted
              emptyMessage="Reconstruction not returned — required for autoencoder inspection."
              isAnalyzing={isInspecting}
            />

            <InspectionImagePanel
              title="HEATMAP"
              imageType="heatmap"
              imageSrc={images?.heatmap}
              imageSize={imageSize}
              emptyMessage="Heatmap not returned by API."
              isAnalyzing={isInspecting}
            />

            <InspectionImagePanel
              title="MASK"
              imageType="mask"
              imageSrc={images?.mask}
              imageSize={imageSize}
              emptyMessage="Mask not returned by API."
              isAnalyzing={isInspecting}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
