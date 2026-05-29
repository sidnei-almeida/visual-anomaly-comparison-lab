/**
 * Build bottle-only catalog (~50 samples) from MVTec folders in repo root.
 * Run: npx tsx scripts/generate-bottle-catalog.ts
 */

import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

type DefectFolder = "good" | "broken_large" | "broken_small" | "contamination";

interface CatalogSpec {
  folder: DefectFolder;
  sourceId: string;
  /** Existing catalog filename to keep (skip copy if present). */
  existingFilename?: string;
}

const ROOT = resolve(import.meta.dirname, "..");
const CATALOG_DIR = join(ROOT, "data", "catalog");

const DEFECT_META: Record<
  DefectFolder,
  { label: "normal" | "anomaly"; category: string; defectType: string; title: string }
> = {
  good: {
    label: "normal",
    category: "bottle-good",
    defectType: "good",
    title: "Pass",
  },
  broken_large: {
    label: "anomaly",
    category: "bottle-broken_large",
    defectType: "broken_large",
    title: "Large Break",
  },
  broken_small: {
    label: "anomaly",
    category: "bottle-broken_small",
    defectType: "broken_small",
    title: "Small Break",
  },
  contamination: {
    label: "anomaly",
    category: "bottle-contamination",
    defectType: "contamination",
    title: "Contamination",
  },
};

import {
  EXCLUDED_PASS_FILENAMES,
  EXCLUDED_PASS_SOURCE_IDS,
} from "./excluded-pass-samples";

/** Full MVTec bottle spread; Pass entries in EXCLUDED_* are omitted from the demo. */
const SELECTION: CatalogSpec[] = [
  { folder: "good", sourceId: "006", existingFilename: "inspect-bottle-good-a.png" },
  { folder: "broken_large", sourceId: "012", existingFilename: "inspect-bottle-broken-large.png" },
  { folder: "broken_small", sourceId: "017", existingFilename: "inspect-bottle-broken-small.png" },
  { folder: "contamination", sourceId: "010", existingFilename: "inspect-bottle-contamination.png" },

  { folder: "good", sourceId: "000" },
  { folder: "good", sourceId: "001" },
  { folder: "good", sourceId: "002" },
  { folder: "good", sourceId: "003" },
  { folder: "good", sourceId: "004" },
  { folder: "good", sourceId: "005" },
  { folder: "good", sourceId: "007" },
  { folder: "good", sourceId: "009" },
  { folder: "good", sourceId: "011" },
  { folder: "good", sourceId: "013" },
  { folder: "good", sourceId: "015" },
  { folder: "good", sourceId: "019" },
  { folder: "good", sourceId: "001", existingFilename: "inspect-bottle-good-b.png" },

  { folder: "broken_large", sourceId: "000" },
  { folder: "broken_large", sourceId: "001" },
  { folder: "broken_large", sourceId: "003" },
  { folder: "broken_large", sourceId: "005" },
  { folder: "broken_large", sourceId: "007" },
  { folder: "broken_large", sourceId: "009" },
  { folder: "broken_large", sourceId: "011" },
  { folder: "broken_large", sourceId: "013" },
  { folder: "broken_large", sourceId: "015" },
  { folder: "broken_large", sourceId: "017" },
  { folder: "broken_large", sourceId: "019" },

  { folder: "broken_small", sourceId: "000" },
  { folder: "broken_small", sourceId: "001" },
  { folder: "broken_small", sourceId: "002" },
  { folder: "broken_small", sourceId: "004" },
  { folder: "broken_small", sourceId: "006" },
  { folder: "broken_small", sourceId: "008" },
  { folder: "broken_small", sourceId: "010" },
  { folder: "broken_small", sourceId: "012" },
  { folder: "broken_small", sourceId: "014" },
  { folder: "broken_small", sourceId: "016" },
  { folder: "broken_small", sourceId: "018" },
  { folder: "broken_small", sourceId: "020" },

  { folder: "contamination", sourceId: "000" },
  { folder: "contamination", sourceId: "001" },
  { folder: "contamination", sourceId: "002" },
  { folder: "contamination", sourceId: "003" },
  { folder: "contamination", sourceId: "005" },
  { folder: "contamination", sourceId: "007" },
  { folder: "contamination", sourceId: "009" },
  { folder: "contamination", sourceId: "011" },
  { folder: "contamination", sourceId: "013" },
  { folder: "contamination", sourceId: "015" },
  { folder: "contamination", sourceId: "017" },
];

function catalogFilename(folder: DefectFolder, sourceId: string, existing?: string): string {
  if (existing) return existing;
  if (folder === "good") return `inspect-bottle-good-${sourceId}.png`;
  if (folder === "broken_large") return `inspect-bottle-broken-large-${sourceId}.png`;
  if (folder === "broken_small") return `inspect-bottle-broken-small-${sourceId}.png`;
  return `inspect-bottle-contamination-${sourceId}.png`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isExcluded(spec: CatalogSpec): boolean {
  if (spec.folder !== "good") return false;
  if (EXCLUDED_PASS_SOURCE_IDS.has(spec.sourceId)) return true;
  const filename = catalogFilename(spec.folder, spec.sourceId, spec.existingFilename);
  return EXCLUDED_PASS_FILENAMES.has(filename);
}

function main(): void {
  mkdirSync(CATALOG_DIR, { recursive: true });

  const seen = new Set<string>();
  const selection = SELECTION.filter((spec) => {
    const filename = catalogFilename(spec.folder, spec.sourceId, spec.existingFilename);
    if (seen.has(filename)) return false;
    seen.add(filename);
    return !isExcluded(spec);
  });

  const entries = selection.map((spec) => {
    const meta = DEFECT_META[spec.folder];
    const filename = catalogFilename(spec.folder, spec.sourceId, spec.existingFilename);
    const sourcePath = join(ROOT, spec.folder, `${spec.sourceId}.png`);
    const destPath = join(CATALOG_DIR, filename);

    if (!spec.existingFilename) {
      copyFileSync(sourcePath, destPath);
    }

    const suffix =
      filename === "inspect-bottle-good-b.png"
        ? "b"
        : spec.existingFilename === "inspect-bottle-good-a.png"
          ? "006"
          : spec.sourceId;
    return {
      filename,
      name: `Bottle - ${meta.title} · ${suffix}`,
      label: meta.label,
      category: meta.category,
      product: "bottle" as const,
      defectType: meta.defectType,
    };
  });

  const catalogTs = `/**
 * Inspection catalog — bottle-only demo samples in \`data/catalog/\`, served at \`/api/samples/{filename}\`.
 * Generated by scripts/generate-bottle-catalog.ts — do not edit by hand.
 */

import type { InspectionSample } from "@/types/inspection";
import { sampleImageUrl } from "@/data/sample-images";

export const INSPECTION_CATALOG_DIR = "catalog";

export interface CatalogEntryMeta {
  filename: string;
  name: string;
  label: "normal" | "anomaly";
  category: string;
  product: "bottle";
  defectType: string;
}

export const INSPECTION_CATALOG: CatalogEntryMeta[] = ${JSON.stringify(
    entries.map(({ filename, name, label, category, product, defectType }) => ({
      filename,
      name,
      label,
      category,
      product,
      defectType,
    })),
    null,
    2,
  )};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function listCatalogSamples(): InspectionSample[] {
  return INSPECTION_CATALOG.map((entry, index) => ({
    id: \`curated-\${index}-\${slugify(entry.name)}\`,
    name: entry.name,
    filename: entry.filename,
    imageUrl: sampleImageUrl(entry.filename),
    label: entry.label,
    category: entry.category,
    source: "curated" as const,
    rotation: 0,
    metadata: {
      product: entry.product,
      defectType: entry.defectType,
    },
  }));
}

export function getCatalogSampleByFilename(filename: string): CatalogEntryMeta | undefined {
  return INSPECTION_CATALOG.find((e) => e.filename === filename);
}
`;

  const manifest = {
    generatedAt: new Date().toISOString(),
    count: entries.length,
    normal: entries.filter((e) => e.label === "normal").length,
    anomaly: entries.filter((e) => e.label === "anomaly").length,
    entries: entries.map(({ filename, name, label, source }) => ({ filename, name, label, source })),
  };

  writeFileSync(join(ROOT, "src/data/inspection-catalog.ts"), catalogTs);
  writeFileSync(join(CATALOG_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`Catalog: ${entries.length} bottle samples`);
  console.log(`  normal: ${manifest.normal}`);
  console.log(`  anomaly: ${manifest.anomaly}`);
  console.log(`Wrote src/data/inspection-catalog.ts`);
  console.log(`Wrote data/catalog/manifest.json`);
}

main();
