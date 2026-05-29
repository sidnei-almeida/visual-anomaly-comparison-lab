"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Maximize2 } from "lucide-react";
import {
  boxToModelPixels,
  computeContainLayout,
  detectBboxFormat,
  logBboxDebug,
  modelBoxToNaturalBox,
  modelBoxToRenderedRect,
  resolveModelSize,
  type ContainLayout,
} from "@/lib/bbox-layout";
import type { PredictBox } from "@/types/predict-api";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/IconButton";

const DEBUG_BBOX = process.env.NEXT_PUBLIC_DEBUG_BBOX === "true";

function boxZScore(box: PredictBox): number {
  return box.max_z ?? box.score ?? 0;
}

function bracketArmLength(width: number, height: number): number {
  return Math.min(20, Math.max(8, Math.min(width, height) * 0.22));
}

export type InspectionImageType = "original" | "reconstruction" | "heatmap" | "mask";

const STAGE_CLASS_BY_TYPE: Record<InspectionImageType, string> = {
  original: "result-panel__stage--light",
  reconstruction: "result-panel__stage--light",
  heatmap: "result-panel__stage--heatmap",
  mask: "result-panel__stage--mask",
};

const PANEL_IN_DELAY_MS: Record<InspectionImageType, number> = {
  original: 0,
  reconstruction: 60,
  heatmap: 120,
  mask: 180,
};

const LOADING_LABELS: Record<InspectionImageType, string> = {
  original: "Analyzing…",
  reconstruction: "AWAITING RECONSTRUCTION",
  heatmap: "COMPUTING HEATMAP",
  mask: "GENERATING MASK",
};

interface InspectionImagePanelProps {
  title: string;
  imageType: InspectionImageType;
  subtitle?: string;
  imageSrc?: string | null;
  imageSize?: { width: number; height: number };
  boxes?: PredictBox[];
  showBoxes?: boolean;
  badgeLabel?: string | null;
  emptyMessage?: string;
  highlighted?: boolean;
  debugCategory?: string;
  isAnalyzing?: boolean;
}

export function InspectionImagePanel({
  title,
  imageType,
  subtitle,
  imageSrc,
  imageSize,
  boxes = [],
  showBoxes = false,
  badgeLabel,
  emptyMessage,
  highlighted,
  debugCategory,
  isAnalyzing = false,
}: InspectionImagePanelProps) {
  const modelSize = resolveModelSize(imageSize);
  const shouldDrawBoxes = showBoxes && boxes.length > 0;

  const [layout, setLayout] = useState<ContainLayout | null>(null);
  const [scanlineVisible, setScanlineVisible] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const scanlineSrcRef = useRef<string | null>(null);

  const measureLayout = useCallback(
    (img: HTMLImageElement) => {
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      const clientWidth = img.clientWidth;
      const clientHeight = img.clientHeight;

      const nextLayout = computeContainLayout(
        naturalWidth,
        naturalHeight,
        clientWidth,
        clientHeight,
      );
      setLayout(nextLayout);

      if (shouldDrawBoxes && nextLayout && boxes.length > 0 && DEBUG_BBOX) {
        const naturalSize = { width: naturalWidth, height: naturalHeight };
        const clientSize = { width: clientWidth, height: clientHeight };
        for (const box of boxes) {
          const format = detectBboxFormat(box, modelSize);
          const modelBox = boxToModelPixels(box, modelSize);
          const naturalBox = modelBoxToNaturalBox(box, modelSize, naturalSize);
          const rendered = modelBoxToRenderedRect(box, modelSize, naturalSize, nextLayout);
          logBboxDebug({
            category: debugCategory,
            modelSize,
            naturalSize,
            clientSize,
            rawBox: box,
            format,
            modelBox,
            naturalBox,
            rendered,
          });
        }
      }
    },
    [boxes, debugCategory, modelSize, shouldDrawBoxes],
  );

  const onImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      measureLayout(event.currentTarget);

      if (
        (imageType === "heatmap" || imageType === "mask") &&
        imageSrc &&
        scanlineSrcRef.current !== imageSrc
      ) {
        scanlineSrcRef.current = imageSrc;
        setScanlineVisible(true);
      }
    },
    [imageSrc, imageType, measureLayout],
  );

  useEffect(() => {
    if (!imageSrc) {
      scanlineSrcRef.current = null;
      setScanlineVisible(false);
    }
  }, [imageSrc]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img || !imageSrc) {
      setLayout(null);
      return;
    }

    if (img.complete && img.naturalWidth > 0) {
      measureLayout(img);

      if (
        (imageType === "heatmap" || imageType === "mask") &&
        scanlineSrcRef.current !== imageSrc
      ) {
        scanlineSrcRef.current = imageSrc;
        setScanlineVisible(true);
      }
    }

    const observer = new ResizeObserver(() => {
      if (img.naturalWidth > 0) measureLayout(img);
    });
    observer.observe(img);
    return () => observer.disconnect();
  }, [imageSrc, imageType, measureLayout]);

  const primaryBoxIndex = useMemo(() => {
    if (boxes.length === 0) return -1;

    let bestIndex = 0;
    let bestScore = boxZScore(boxes[0]!);

    boxes.forEach((box, index) => {
      const score = boxZScore(box);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    return bestIndex;
  }, [boxes]);

  const renderedBoxes = useMemo(() => {
    if (!shouldDrawBoxes || !layout || layout.clientWidth <= 0) return [];

    const naturalSize = {
      width: layout.naturalWidth,
      height: layout.naturalHeight,
    };

    return boxes.map((box, index) => {
      const rect = modelBoxToRenderedRect(box, modelSize, naturalSize, layout);

      return {
        key: `box-${index}-${box.x}-${box.y}`,
        rect,
        box,
        isPrimary: index === primaryBoxIndex,
        armLen: bracketArmLength(rect.width, rect.height),
      };
    });
  }, [boxes, layout, modelSize, primaryBoxIndex, shouldDrawBoxes]);

  const showLoadingPlaceholder = isAnalyzing && !imageSrc;
  const showAnalyzingOverlay = isAnalyzing && Boolean(imageSrc) && imageType === "original";

  return (
    <div
      className={cn(
        "result-panel border",
        highlighted ? "border-lab-terra/50" : "border-lab-border",
      )}
    >
      <header className="result-panel__header flex items-center justify-between">
        <div className="min-w-0">
          <span className="result-panel__title">{title}</span>
          {subtitle && <p className="truncate text-[8px] text-lab-muted">{subtitle}</p>}
        </div>
        <IconButton label={`Expand ${title}`} className="h-[22px] w-[22px] shrink-0 border-0 bg-transparent">
          <Maximize2 className="h-3 w-3" />
        </IconButton>
      </header>

      <div
        className={cn(
          "result-panel__stage result-panel__stage--panel-in",
          STAGE_CLASS_BY_TYPE[imageType],
          isAnalyzing && "result-panel__stage--loading",
        )}
        style={{ animationDelay: `${PANEL_IN_DELAY_MS[imageType]}ms` }}
      >
        {showLoadingPlaceholder ? (
          <div className="panel-loading-placeholder">
            <span className="lab-spinner" aria-hidden />
            <span className="panel-loading-placeholder__label">{LOADING_LABELS[imageType]}</span>
          </div>
        ) : !imageSrc ? (
          <div className="panel-empty-state">
            <AlertTriangle className="panel-empty-state__icon" aria-hidden />
            <p className="panel-empty-state__text">{emptyMessage ?? "Image not returned by API."}</p>
          </div>
        ) : (
          <div className="result-panel__square">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageSrc}
              alt={title}
              className="result-panel__image"
              onLoad={onImageLoad}
            />

            {scanlineVisible && (imageType === "heatmap" || imageType === "mask") && (
              <div
                className={cn(
                  "scanline-overlay",
                  imageType === "mask" && "scanline-overlay--delayed",
                )}
                onAnimationEnd={() => setScanlineVisible(false)}
                aria-hidden
              />
            )}

            {shouldDrawBoxes && (
              <div className="pointer-events-none absolute inset-0" aria-hidden>
                {renderedBoxes.map(({ key, rect, box, isPrimary, armLen }) => {
                  const zLabel =
                    box.max_z != null || box.score != null
                      ? `z ${(box.max_z ?? box.score ?? 0).toFixed(1)}`
                      : null;

                  return (
                    <div
                      key={key}
                      className={cn(
                        "bbox-wrapper",
                        isPrimary ? "bbox-wrapper--primary" : "bbox-wrapper--secondary",
                      )}
                      style={{
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
                        ["--arm" as string]: `${armLen}px`,
                        ["--bracket-weight" as string]: isPrimary ? "1.5px" : "1px",
                      }}
                    >
                      <span className="bbox-corner bbox-corner--tl" />
                      <span className="bbox-corner bbox-corner--tr" />
                      <span className="bbox-corner bbox-corner--bl" />
                      <span className="bbox-corner bbox-corner--br" />
                      {zLabel && (
                        <span
                          className={cn(
                            "bbox-label",
                            isPrimary ? "bbox-label--primary" : "bbox-label--secondary",
                          )}
                        >
                          {zLabel}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {showAnalyzingOverlay && (
              <div className="panel-analyzing-badge">
                <span className="lab-spinner lab-spinner--sm" aria-hidden />
                Analyzing…
              </div>
            )}

            {badgeLabel && !showAnalyzingOverlay && (
              <div className="absolute bottom-1 left-1 z-10">
                <div
                  className={cn(
                    "rounded px-1 py-0.5 text-[8px]",
                    highlighted
                      ? "border border-lab-terra/40 bg-[#241810]/90 font-medium text-lab-cream"
                      : "border border-lab-border bg-black/70 text-lab-muted",
                  )}
                >
                  {badgeLabel}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
