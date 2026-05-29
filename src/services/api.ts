export {
  getApiBaseUrl,
  getApiHealth,
  fetchApiMetadata,
  predictAnomaly,
  inspectSample,
  inspectUpload,
  assertApiReadyForInference,
} from "@/lib/anomaly-api";

import {
  getApiBaseUrl,
  getApiHealth,
  fetchApiMetadata,
  predictAnomaly,
  inspectSample,
  inspectUpload,
} from "@/lib/anomaly-api";

export const api = {
  getBaseUrl: getApiBaseUrl,
  getHealth: getApiHealth,
  getMetadata: fetchApiMetadata,
  predict: predictAnomaly,
  inspectSample,
  inspectUpload,
};

export default api;
