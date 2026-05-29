/**
 * Rebuild inspection-catalog.ts: full bottle set minus excluded Pass samples.
 * Run: npx tsx scripts/rebuild-bottle-catalog.ts
 */

import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  EXCLUDED_PASS_FILENAMES,
  EXCLUDED_PASS_SOURCE_IDS,
} from "./excluded-pass-samples";

type DefectFolder = "good" | "broken_large" | "broken_small" | "contamination";

interface CatalogSpec {
  folder: DefectFolder;
  sourceId: string;
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

const FULL_SELECTION: CatalogSpec[] = [
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

function isExcluded(spec: CatalogSpec): boolean {
  if (spec.folder !== "good") return false;
  if (EXCLUDED_PASS_SOURCE_IDS.has(spec.sourceId)) return true;
  const filename = catalogFilename(spec.folder, spec.sourceId, spec.existingFilename);
  return EXCLUDED_PASS_FILENAMES.has(filename);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function main(): void {
  const seen = new Set<string>();
  const selection = FULL_SELECTION.filter((spec) => {
    const filename = catalogFilename(spec.folder, spec.sourceId, spec.existingFilename);
    if (seen.has(filename)) return false;
    seen.add(filename);
    return !isExcluded(spec);
  });

  const entries = selection.map((spec) => {
    const meta = DEFECT_META[spec.folder];
    const filename = catalogFilename(spec.folder, spec.sourceId, spec.existingFilename);
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

  const fixed = entries;

  const catalogTs = `/**
 * Inspection catalog — bottle demo samples in \`data/catalog/\`.
 * Some Pass samples excluded (false-positive prone); see scripts/excluded-pass-samples.ts.
 * Regenerate: npx tsx scripts/rebuild-bottle-catalog.ts
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

export const INSPECTION_CATALOG: CatalogEntryMeta[] = ${JSON.stringify(fixed, null, 2)};

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
    count: fixed.length,
    normal: fixed.filter((e) => e.label === "normal").length,
    anomaly: fixed.filter((e) => e.label === "anomaly").length,
    excludedPassFilenames: [...EXCLUDED_PASS_FILENAMES],
    entries: fixed.map(({ filename, name, label }) => ({ filename, name, label })),
  };

  writeFileSync(join(ROOT, "src/data/inspection-catalog.ts"), catalogTs);
  writeFileSync(join(CATALOG_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`Catalog: ${fixed.length} samples (${manifest.normal} Pass, ${manifest.anomaly} anomaly)`);
  console.log(`Excluded ${EXCLUDED_PASS_FILENAMES.size} Pass entries from navigator`);
}

main();
