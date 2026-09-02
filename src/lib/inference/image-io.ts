/**
 * Browser image decoding and encoding for the local inference engine.
 *
 * Decoding goes through `createImageBitmap` at the image's native size; the downscale to
 * 256x256 is done by our Pillow-compatible resampler rather than by canvas scaling, so
 * the model sees the same pixels the Python pipeline produced.
 */

import { resizeBicubic, type RgbImage } from "@/lib/cv/resize";
import { IMAGE_SIZE } from "@/lib/inference/pipeline";

function createCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function get2dContext(
  canvas: OffscreenCanvas | HTMLCanvasElement,
): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D {
  const context = canvas.getContext("2d", { willReadFrequently: true }) as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  if (!context) {
    throw new Error("Canvas 2D context unavailable in this browser.");
  }
  return context;
}

/** Decode an image blob into interleaved RGB bytes at its native resolution. */
export async function decodeToRgb(blob: Blob): Promise<RgbImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob, { colorSpaceConversion: "none" });
  } catch {
    throw new Error("The file is not a valid image.");
  }

  try {
    const canvas = createCanvas(bitmap.width, bitmap.height);
    const context = get2dContext(canvas);
    context.drawImage(bitmap, 0, 0);

    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    const pixelCount = bitmap.width * bitmap.height;
    const rgb = new Uint8ClampedArray(pixelCount * 3);

    for (let i = 0; i < pixelCount; i += 1) {
      const source = i * 4;
      const target = i * 3;
      rgb[target] = data[source];
      rgb[target + 1] = data[source + 1];
      rgb[target + 2] = data[source + 2];
    }

    return { width: bitmap.width, height: bitmap.height, data: rgb };
  } finally {
    bitmap.close();
  }
}

/** Decode and resample a blob to the 256x256 RGB image the model expects. */
export async function decodeToModelInput(blob: Blob): Promise<Uint8ClampedArray> {
  const decoded = await decodeToRgb(blob);
  return resizeBicubic(decoded, IMAGE_SIZE, IMAGE_SIZE).data;
}

async function canvasToDataUrl(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<string> {
  if (canvas instanceof HTMLCanvasElement) {
    return canvas.toDataURL("image/png");
  }

  const blob = await canvas.convertToBlob({ type: "image/png" });
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not encode the result image."));
    reader.readAsDataURL(blob);
  });
}

/** Encode interleaved RGB bytes as a PNG data URL. */
export async function encodeRgbToDataUrl(
  rgb: Uint8ClampedArray,
  width = IMAGE_SIZE,
  height = IMAGE_SIZE,
): Promise<string> {
  const canvas = createCanvas(width, height);
  const context = get2dContext(canvas);
  const image = context.createImageData(width, height);

  for (let i = 0; i < width * height; i += 1) {
    const source = i * 3;
    const target = i * 4;
    image.data[target] = rgb[source];
    image.data[target + 1] = rgb[source + 1];
    image.data[target + 2] = rgb[source + 2];
    image.data[target + 3] = 255;
  }

  context.putImageData(image, 0, 0);
  return canvasToDataUrl(canvas);
}

/** Encode a single-channel plane as a grayscale PNG data URL. */
export async function encodeGrayToDataUrl(
  gray: Uint8Array,
  width = IMAGE_SIZE,
  height = IMAGE_SIZE,
): Promise<string> {
  const rgb = new Uint8ClampedArray(width * height * 3);
  for (let i = 0; i < gray.length; i += 1) {
    const target = i * 3;
    rgb[target] = gray[i];
    rgb[target + 1] = gray[i];
    rgb[target + 2] = gray[i];
  }
  return encodeRgbToDataUrl(rgb, width, height);
}
