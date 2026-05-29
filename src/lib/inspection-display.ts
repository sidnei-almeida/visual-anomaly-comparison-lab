import type { InspectionResult } from "@/types/inspection";
import type { PredictApiResponse } from "@/types/predict-api";

export const BOX_CAPTION_ANOMALY = "Approximate suspicious regions";
export const BOX_CAPTION_NORMAL = "No suspicious regions displayed for normal samples";
export const BOX_NOTE_SHORT = "Approx. visual hints";
export const BBOX_DISCLAIMER_SHORT =
  "Boxes are approximate visual hints, not exact segmentation.";

export function shortLocalizationMethod(method: string): string {
  if (method.includes("reconstruction")) return "Recon error";
  if (method.length > 18) return `${method.slice(0, 16)}…`;
  return method;
}

/** Whether to draw client-side boxes on the original image. */
export function shouldRenderPredictBoxes(
  result: InspectionResult | PredictApiResponse | null | undefined,
): boolean {
  if (!result) return false;

  const isAnomaly =
    "is_anomaly" in result ? result.is_anomaly === true : result.isAnomaly === true;
  const status = String(result.status).trim().toLowerCase();
  const boxes = result.boxes;

  return (
    isAnomaly === true &&
    status === "anomaly" &&
    Array.isArray(boxes) &&
    boxes.length > 0
  );
}

export function getOriginalPanelRegionCaption(
  result: InspectionResult | null | undefined,
): string {
  if (!result) return "Original";
  if (shouldRenderPredictBoxes(result)) return BOX_CAPTION_ANOMALY;
  if (!result.isAnomaly) return BOX_CAPTION_NORMAL;
  return "Original";
}

export function getComparisonLabRegionNote(
  result: InspectionResult | null | undefined,
): string {
  if (!result) return "Denoising ConvAutoencoder · category-normalized z-map";
  if (result.isUnsupported) return result.unsupportedMessage ?? "Unsupported category for this model";
  if (shouldRenderPredictBoxes(result)) return BOX_CAPTION_ANOMALY;
  if (!result.isAnomaly) return BOX_CAPTION_NORMAL;
  return "No suspicious region box was generated, but the anomaly score may still indicate abnormal behavior.";
}
