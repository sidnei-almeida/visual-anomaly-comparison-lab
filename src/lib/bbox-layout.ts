import type { PredictBox } from "@/types/predict-api";

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ContainLayout {
  naturalWidth: number;
  naturalHeight: number;
  clientWidth: number;
  clientHeight: number;
  scale: number;
  renderedWidth: number;
  renderedHeight: number;
  offsetX: number;
  offsetY: number;
}

export interface RenderedBoxRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type BboxFormat = "pixel_xywh" | "normalized_xywh" | "invalid";

const DEBUG_BBOX = process.env.NEXT_PUBLIC_DEBUG_BBOX === "true";

export function detectBboxFormat(
  box: PredictBox,
  modelSize: ImageDimensions,
): BboxFormat {
  const { width, height } = modelSize;
  if (width <= 0 || height <= 0) return "invalid";

  const values = [box.x, box.y, box.w, box.h];
  if (!values.every(Number.isFinite)) return "invalid";
  if (box.w <= 0 || box.h <= 0) return "invalid";

  const maxCoord = Math.max(box.x, box.y, box.x + box.w, box.y + box.h);
  if (maxCoord <= 1.01 && box.x >= 0 && box.y >= 0) {
    return "normalized_xywh";
  }

  if (box.x + box.w <= width + 1 && box.y + box.h <= height + 1) {
    return "pixel_xywh";
  }

  return "invalid";
}

/** Normalize API box into model pixel space (image_size). */
export function boxToModelPixels(
  box: PredictBox,
  modelSize: ImageDimensions,
): PredictBox {
  const format = detectBboxFormat(box, modelSize);
  const { width, height } = modelSize;

  if (format === "normalized_xywh") {
    return {
      ...box,
      x: box.x * width,
      y: box.y * height,
      w: box.w * width,
      h: box.h * height,
    };
  }

  return { ...box };
}

/** Map model-space box to natural image pixels (e.g. catalog 1024 when model is 256). */
export function modelBoxToNaturalBox(
  box: PredictBox,
  modelSize: ImageDimensions,
  naturalSize: ImageDimensions,
): PredictBox {
  const modelBox = boxToModelPixels(box, modelSize);
  const scaleX = naturalSize.width / modelSize.width;
  const scaleY = naturalSize.height / modelSize.height;

  return {
    ...modelBox,
    x: modelBox.x * scaleX,
    y: modelBox.y * scaleY,
    w: modelBox.w * scaleX,
    h: modelBox.h * scaleY,
  };
}

export function computeContainLayout(
  naturalWidth: number,
  naturalHeight: number,
  clientWidth: number,
  clientHeight: number,
): ContainLayout | null {
  if (
    naturalWidth <= 0 ||
    naturalHeight <= 0 ||
    clientWidth <= 0 ||
    clientHeight <= 0
  ) {
    return null;
  }

  const scale = Math.min(clientWidth / naturalWidth, clientHeight / naturalHeight);
  const renderedWidth = naturalWidth * scale;
  const renderedHeight = naturalHeight * scale;
  const offsetX = (clientWidth - renderedWidth) / 2;
  const offsetY = (clientHeight - renderedHeight) / 2;

  return {
    naturalWidth,
    naturalHeight,
    clientWidth,
    clientHeight,
    scale,
    renderedWidth,
    renderedHeight,
    offsetX,
    offsetY,
  };
}

/** Map natural-image box to pixel rect inside the image client box (object-fit: contain). */
export function naturalBoxToRenderedRect(
  box: PredictBox,
  naturalSize: ImageDimensions,
  layout: ContainLayout,
): RenderedBoxRect {
  const { naturalWidth, naturalHeight, renderedWidth, renderedHeight, offsetX, offsetY } =
    layout;

  return {
    left: offsetX + (box.x / naturalWidth) * renderedWidth,
    top: offsetY + (box.y / naturalHeight) * renderedHeight,
    width: (box.w / naturalWidth) * renderedWidth,
    height: (box.h / naturalHeight) * renderedHeight,
  };
}

/** Full pipeline: API/model box → rendered overlay pixels. */
export function modelBoxToRenderedRect(
  box: PredictBox,
  modelSize: ImageDimensions,
  naturalSize: ImageDimensions,
  layout: ContainLayout,
): RenderedBoxRect {
  const naturalBox = modelBoxToNaturalBox(box, modelSize, naturalSize);
  return naturalBoxToRenderedRect(naturalBox, naturalSize, layout);
}

export interface BboxDebugContext {
  category?: string;
  modelSize: ImageDimensions;
  naturalSize: ImageDimensions;
  clientSize: ImageDimensions;
  rawBox: PredictBox;
  format: BboxFormat;
  modelBox: PredictBox;
  naturalBox: PredictBox;
  rendered: RenderedBoxRect;
}

export function logBboxDebug(context: BboxDebugContext): void {
  if (!DEBUG_BBOX) return;
  console.info("[bbox]", {
    category: context.category,
    format: context.format,
    modelSize: context.modelSize,
    naturalSize: context.naturalSize,
    clientSize: context.clientSize,
    rawBox: context.rawBox,
    modelBox: context.modelBox,
    naturalBox: context.naturalBox,
    rendered: context.rendered,
  });
}

export function resolveModelSize(imageSize?: ImageDimensions): ImageDimensions {
  const width = imageSize?.width && imageSize.width > 0 ? imageSize.width : 256;
  const height = imageSize?.height && imageSize.height > 0 ? imageSize.height : 256;
  return { width, height };
}

/** Prefer API original (model space) when drawing boxes; fallback only if needed. */
export function resolveOriginalImageForBoxes(
  apiOriginal: string | null | undefined,
  catalogUrl: string | null | undefined,
  showBoxes: boolean,
): string | null | undefined {
  if (showBoxes) {
    return apiOriginal ?? catalogUrl;
  }
  return apiOriginal ?? catalogUrl;
}
