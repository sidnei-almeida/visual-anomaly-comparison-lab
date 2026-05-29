import { getApiBaseUrl } from "@/lib/anomaly-api";

const ENV_API_BASE =
  process.env.NEXT_PUBLIC_ANOMALY_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_ANOMALY_API_BASE_URL ??
  process.env.NEXT_PUBLIC_VITE_API_BASE_URL ??
  process.env.REACT_APP_API_URL;

/** GET target for the startup health gate — polls until HTTP 200. */
export const HEALTH_CHECK_URL = ENV_API_BASE
  ? `${ENV_API_BASE.replace(/\/$/, "")}/health`
  : `${getApiBaseUrl()}/health`;

export const HEALTH_CHECK_POLL_MS = 3000;
export const HEALTH_CHECK_TIMEOUT_MS = 5000;
export const HEALTH_CHECK_READY_GRACE_MS = 600;
