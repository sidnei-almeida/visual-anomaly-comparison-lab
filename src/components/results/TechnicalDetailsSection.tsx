"use client";

import type { ApiCategory } from "@/config/api-categories";
import {
  DAE_BBOX_METHOD,
  DAE_BBOX_PARAMS,
  DAE_BBOX_UI,
  DAE_IMAGE_SIZE,
  DAE_INFERENCE_PIPELINE,
  DAE_LOCALIZATION_METHOD,
  DAE_MODEL_NAME,
  DAE_SCORE_MAP_FORMULA,
  DAE_THRESHOLD_PERCENTILE,
  formatCategoryThreshold,
} from "@/config/mvtec-dae-artifacts";
import { Panel } from "@/components/ui/Panel";

interface TechnicalDetailsSectionProps {
  category: ApiCategory;
  apiThreshold?: number | null;
  thresholdMatchesArtifact?: boolean | null;
  bboxMethod?: string | null;
  experimentName?: string | null;
}

export function TechnicalDetailsSection({
  category,
  apiThreshold,
  thresholdMatchesArtifact,
  bboxMethod,
  experimentName,
}: TechnicalDetailsSectionProps) {
  const bboxMethodValue = bboxMethod ?? DAE_BBOX_METHOD;
  const sourcePath = `src/data/model-artifacts/ · percentile ${DAE_THRESHOLD_PERCENTILE}`;

  return (
    <Panel className="summary-card">
      <details>
        <summary className="summary-card-title cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          Technical details
        </summary>
        <div className="mt-2 space-y-2 text-[10px] leading-snug text-lab-muted">
          <p>
            <span className="text-lab-text">Input size:</span> {DAE_IMAGE_SIZE}×{DAE_IMAGE_SIZE} RGB
          </p>
          <p>
            <span className="text-lab-text">Threshold (p95):</span> {formatCategoryThreshold(category)}
          </p>
          {apiThreshold != null && (
            <p>
              <span className="text-lab-text">API threshold:</span>{" "}
              {thresholdMatchesArtifact === false
                ? `${apiThreshold.toFixed(3)} ⚠ differs from artifact`
                : `${apiThreshold.toFixed(3)} ✓ matches artifact`}
            </p>
          )}
          <p>
            <span className="text-lab-text">BBox method:</span> {bboxMethodValue}
          </p>
          <p>
            <span className="text-lab-text">Localization:</span> {DAE_LOCALIZATION_METHOD}
          </p>
          <p>
            <span className="text-lab-text">Z-map:</span> {DAE_SCORE_MAP_FORMULA}
          </p>
          <p>
            Boxes: p{DAE_BBOX_PARAMS.high_percentile}/p{DAE_BBOX_PARAMS.low_percentile}, min area{" "}
            {DAE_BBOX_PARAMS.min_area}, max {DAE_BBOX_PARAMS.max_boxes}, min mean z{" "}
            {DAE_BBOX_PARAMS.min_mean_z}
          </p>
          {experimentName && (
            <p>
              <span className="text-lab-text">Experiment:</span> {experimentName}
            </p>
          )}
          <p>
            <span className="text-lab-text">Architecture ref:</span> {DAE_MODEL_NAME}
          </p>
          <p className="truncate" title={sourcePath}>
            <span className="text-lab-text">Source:</span> {sourcePath}
          </p>
          <p className="text-amber-400/90">{DAE_BBOX_UI.warning}</p>
          <div>
            <p className="mb-1 text-lab-text">Inference pipeline</p>
            <ol className="list-decimal pl-4">
              {DAE_INFERENCE_PIPELINE.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      </details>
    </Panel>
  );
}
