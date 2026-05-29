/**
 * POST /predict — aligned with `src/data/model-artifacts/`
 */

import {
  DAE_BBOX_METHOD,
  DAE_BBOX_PARAMS,
  DAE_BBOX_UI,
  DAE_EXPERIMENT_NAME,
  DAE_INFERENCE_PIPELINE,
  DAE_MODEL_NAME,
  DAE_RECOMMENDED_SCORE,
  DAE_Z_SCORE_THRESHOLDS,
} from "@/config/mvtec-dae-artifacts";

export const API_RESPONSE_REFERENCE = {
  endpoint: "POST /predict",
  experiment: DAE_EXPERIMENT_NAME,
  model: DAE_MODEL_NAME,
  score: DAE_RECOMMENDED_SCORE,
  categories: Object.keys(DAE_Z_SCORE_THRESHOLDS),
  categoryThresholds: DAE_Z_SCORE_THRESHOLDS,
  bboxMethod: DAE_BBOX_METHOD,
  bboxParams: {
    highPercentile: DAE_BBOX_PARAMS.high_percentile,
    lowPercentile: DAE_BBOX_PARAMS.low_percentile,
    minArea: DAE_BBOX_PARAMS.min_area,
    maxBoxes: DAE_BBOX_PARAMS.max_boxes,
    minMeanZ: DAE_BBOX_PARAMS.min_mean_z,
  },
  bboxNote: DAE_BBOX_UI.disclaimer,
  pipeline: DAE_INFERENCE_PIPELINE,
  responseFields: [
    "status",
    "is_anomaly",
    "category",
    "model.experiment_name",
    "model.model_name",
    "model.score_name",
    "scores.anomaly_score",
    "scores.threshold",
    "scores.error_mean",
    "scores.z_map_max",
    "image_size",
    "boxes[]",
    "images.original",
    "images.reconstruction",
    "images.heatmap",
    "images.mask",
    "debug.latency_ms",
    "debug.localization_note",
  ],
} as const;
