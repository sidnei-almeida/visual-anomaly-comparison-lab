import type { InspectionSample } from "@/types/inspection";
import { listCatalogSamples, getCatalogSampleByFilename } from "@/data/inspection-catalog";
import { sampleImageUrl } from "@/data/sample-images";

/** URL prefix for curated inspection samples (served from data/catalog/). */
export const SAMPLE_IMAGE_BASE = "/api/samples";

export function buildSampleImageUrl(filename: string): string {
  return sampleImageUrl(filename);
}

export function listCuratedSamples(): InspectionSample[] {
  return listCatalogSamples();
}

export function getCuratedSampleById(id: string): InspectionSample | undefined {
  return listCuratedSamples().find((sample) => sample.id === id);
}

export function getCuratedSampleByFilename(filename: string): InspectionSample | undefined {
  const meta = getCatalogSampleByFilename(filename);
  if (!meta) return undefined;
  return listCuratedSamples().find((s) => s.filename === filename);
}

/** Load image from URL and optionally rotate before returning a File for API upload. */
export async function sampleUrlToFile(
  imageUrl: string,
  filename: string,
  rotation = 0,
): Promise<File> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Unable to fetch sample: ${imageUrl}`);
  }

  const blob = await response.blob();
  if (!rotation) {
    return new File([blob], filename, { type: blob.type || "image/png" });
  }

  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  const rotated = rotation === 90 || rotation === 270;
  canvas.width = rotated ? bitmap.height : bitmap.width;
  canvas.height = rotated ? bitmap.width : bitmap.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  ctx.restore();
  bitmap.close();

  const rotatedBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) reject(new Error("Canvas conversion failed"));
      else resolve(result);
    }, "image/png", 0.92);
  });

  return new File([rotatedBlob], filename, { type: "image/png" });
}

export async function curatedSampleToFile(sample: InspectionSample): Promise<File> {
  return sampleUrlToFile(sample.imageUrl, sample.filename, sample.rotation ?? 0);
}

export const sampleLoader = {
  SAMPLE_IMAGE_BASE,
  listCuratedSamples,
  getCuratedSampleById,
  getCuratedSampleByFilename,
  buildSampleImageUrl,
  sampleUrlToFile,
  curatedSampleToFile,
};

export default sampleLoader;
