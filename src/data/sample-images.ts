/** Curated samples in `data/catalog/`, served at `/api/samples/{filename}`. */

export const SAMPLE_IMAGE_BASE = "/api/samples";

export function sampleImageUrl(filename: string): string {
  return `${SAMPLE_IMAGE_BASE}/${filename}`;
}
