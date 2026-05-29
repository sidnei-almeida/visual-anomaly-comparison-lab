/**
 * Model metadata for the dashboard — sourced from `src/data/model-artifacts/*.json`
 * (exported from training run `mvtec_structured_objects_dae_v1`).
 */

import type { ApiCategory } from "@/config/api-categories";
import { isApiCategory } from "@/config/api-categories";

import experimentConfig from "@/data/model-artifacts/config.json";
import thresholdsArtifact from "@/data/model-artifacts/thresholds.json";
import bboxConfigArtifact from "@/data/model-artifacts/bbox-visualization.json";
import manifestArtifact from "@/data/model-artifacts/manifest.json";

export const DAE_EXPERIMENT_NAME = experimentConfig.experiment_name;
export const DAE_MODEL_NAME = experimentConfig.model_name;
export const DAE_MODEL_CLASS = experimentConfig.model_class;
/** Short label for UI — not the full experiment/architecture id. */
export const DAE_MODEL_TYPE_LABEL = "Multi-product DAE";
export const DAE_IMAGE_SIZE = experimentConfig.preprocessing.image_size;
export const DAE_CATEGORIES = ["bottle"] as const satisfies readonly ApiCategory[];

export const DAE_RECOMMENDED_SCORE = thresholdsArtifact.recommended_score;
export const DAE_THRESHOLD_PERCENTILE = thresholdsArtifact.recommended_threshold_percentile;
export const DAE_THRESHOLD_TYPE = thresholdsArtifact.recommended_threshold_type;

/** Bottle threshold (top_1_z_score, validation p95) used by this demo. */
export const DAE_Z_SCORE_THRESHOLDS: Record<ApiCategory, number> = {
  bottle: thresholdsArtifact.z_score_thresholds.bottle.threshold,
};

export const DAE_BBOX_METHOD = bboxConfigArtifact.bounding_boxes.method;
export const DAE_BBOX_PARAMS = bboxConfigArtifact.bounding_boxes;
export const DAE_LOCALIZATION_METHOD = bboxConfigArtifact.localization_method;

export const DAE_BBOX_UI = {
  disclaimer: bboxConfigArtifact.description,
  warning: bboxConfigArtifact.frontend_guidance.warning,
  recommendedLabel: bboxConfigArtifact.frontend_guidance.recommended_label,
  primaryVisual: bboxConfigArtifact.frontend_guidance.primary_visual,
  boxColorRgb: bboxConfigArtifact.bounding_boxes.box_color_rgb,
  maxBoxes: bboxConfigArtifact.bounding_boxes.max_boxes,
} as const;

export const DAE_EMPTY_BOXES_NOTE =
  "No suspicious region box was generated, but the anomaly score may still indicate abnormal behavior.";

export const DAE_SCORE_NOTES = thresholdsArtifact.notes;

export const DAE_INFERENCE_PIPELINE = manifestArtifact.recommended_inference_pipeline;

export const DAE_SCORE_MAP_FORMULA = bboxConfigArtifact.score_map.formula;

export function getCategoryZThreshold(category: string): number | null {
  if (!isApiCategory(category)) return null;
  return DAE_Z_SCORE_THRESHOLDS[category];
}

export function thresholdsMatchArtifact(
  apiThreshold: number | null | undefined,
  category: string,
  epsilon = 0.02,
): boolean | null {
  const reference = getCategoryZThreshold(category);
  if (reference == null || apiThreshold == null || !Number.isFinite(apiThreshold)) return null;
  return Math.abs(apiThreshold - reference) <= epsilon;
}

export function formatCategoryThreshold(category: ApiCategory): string {
  return `${DAE_Z_SCORE_THRESHOLDS[category].toFixed(2)} (p${DAE_THRESHOLD_PERCENTILE} ${DAE_RECOMMENDED_SCORE})`;
}

export const mvtecDaeArtifacts = {
  experimentConfig,
  thresholdsArtifact,
  bboxConfigArtifact,
  manifestArtifact,
  getCategoryZThreshold,
  thresholdsMatchArtifact,
};
