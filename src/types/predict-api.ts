/** Contract for POST /predict — multi-product denoising conv autoencoder. */

export interface PredictModelInfo {
  experiment_name: string;
  model_name: string;
  score_name: string;
}

export interface PredictScores {
  anomaly_score: number;
  threshold: number;
  error_mean: number;
  z_map_max: number;
}

export interface PredictImageSize {
  width: number;
  height: number;
}

export interface PredictBox {
  x: number;
  y: number;
  w: number;
  h: number;
  area?: number;
  mean_z?: number;
  max_z?: number;
  score?: number;
}

export interface PredictImages {
  original?: string;
  reconstruction?: string;
  heatmap?: string;
  mask?: string;
}

export interface PredictDebug {
  bbox_method?: string;
  localization_note?: string;
  latency_ms?: number;
}

export interface PredictApiResponse {
  status: "normal" | "anomaly" | string;
  is_anomaly: boolean;
  category: string;
  model: PredictModelInfo;
  scores: PredictScores;
  image_size: PredictImageSize;
  boxes: PredictBox[];
  images?: PredictImages;
  debug?: PredictDebug;
}

export interface PredictRequestOptions {
  category: string;
  includeImages?: boolean;
  includeDebug?: boolean;
  includeOverlay?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface PredictOutcome {
  payload: PredictApiResponse;
  latencyMs: number;
}
