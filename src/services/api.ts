export {
  getApiHealth,
  fetchApiMetadata,
  predictAnomaly,
  preloadModel,
  inspectSample,
  inspectUpload,
  assertApiReadyForInference,
} from "@/lib/anomaly-api";

import {
  getApiHealth,
  fetchApiMetadata,
  predictAnomaly,
  preloadModel,
  inspectSample,
  inspectUpload,
} from "@/lib/anomaly-api";

export const api = {
  getHealth: getApiHealth,
  getMetadata: fetchApiMetadata,
  preload: preloadModel,
  predict: predictAnomaly,
  inspectSample,
  inspectUpload,
};

export default api;
