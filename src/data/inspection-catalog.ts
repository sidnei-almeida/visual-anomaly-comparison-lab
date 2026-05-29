/**
 * Inspection catalog — bottle demo samples in `data/catalog/`.
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

export const INSPECTION_CATALOG: CatalogEntryMeta[] = [
  {
    "filename": "inspect-bottle-broken-large.png",
    "name": "Bottle - Large Break · 012",
    "label": "anomaly",
    "category": "bottle-broken_large",
    "product": "bottle",
    "defectType": "broken_large"
  },
  {
    "filename": "inspect-bottle-broken-small.png",
    "name": "Bottle - Small Break · 017",
    "label": "anomaly",
    "category": "bottle-broken_small",
    "product": "bottle",
    "defectType": "broken_small"
  },
  {
    "filename": "inspect-bottle-contamination.png",
    "name": "Bottle - Contamination · 010",
    "label": "anomaly",
    "category": "bottle-contamination",
    "product": "bottle",
    "defectType": "contamination"
  },
  {
    "filename": "inspect-bottle-good-001.png",
    "name": "Bottle - Pass · 001",
    "label": "normal",
    "category": "bottle-good",
    "product": "bottle",
    "defectType": "good"
  },
  {
    "filename": "inspect-bottle-good-003.png",
    "name": "Bottle - Pass · 003",
    "label": "normal",
    "category": "bottle-good",
    "product": "bottle",
    "defectType": "good"
  },
  {
    "filename": "inspect-bottle-good-004.png",
    "name": "Bottle - Pass · 004",
    "label": "normal",
    "category": "bottle-good",
    "product": "bottle",
    "defectType": "good"
  },
  {
    "filename": "inspect-bottle-good-005.png",
    "name": "Bottle - Pass · 005",
    "label": "normal",
    "category": "bottle-good",
    "product": "bottle",
    "defectType": "good"
  },
  {
    "filename": "inspect-bottle-good-009.png",
    "name": "Bottle - Pass · 009",
    "label": "normal",
    "category": "bottle-good",
    "product": "bottle",
    "defectType": "good"
  },
  {
    "filename": "inspect-bottle-good-015.png",
    "name": "Bottle - Pass · 015",
    "label": "normal",
    "category": "bottle-good",
    "product": "bottle",
    "defectType": "good"
  },
  {
    "filename": "inspect-bottle-good-b.png",
    "name": "Bottle - Pass · b",
    "label": "normal",
    "category": "bottle-good",
    "product": "bottle",
    "defectType": "good"
  },
  {
    "filename": "inspect-bottle-broken-large-000.png",
    "name": "Bottle - Large Break · 000",
    "label": "anomaly",
    "category": "bottle-broken_large",
    "product": "bottle",
    "defectType": "broken_large"
  },
  {
    "filename": "inspect-bottle-broken-large-001.png",
    "name": "Bottle - Large Break · 001",
    "label": "anomaly",
    "category": "bottle-broken_large",
    "product": "bottle",
    "defectType": "broken_large"
  },
  {
    "filename": "inspect-bottle-broken-large-003.png",
    "name": "Bottle - Large Break · 003",
    "label": "anomaly",
    "category": "bottle-broken_large",
    "product": "bottle",
    "defectType": "broken_large"
  },
  {
    "filename": "inspect-bottle-broken-large-005.png",
    "name": "Bottle - Large Break · 005",
    "label": "anomaly",
    "category": "bottle-broken_large",
    "product": "bottle",
    "defectType": "broken_large"
  },
  {
    "filename": "inspect-bottle-broken-large-007.png",
    "name": "Bottle - Large Break · 007",
    "label": "anomaly",
    "category": "bottle-broken_large",
    "product": "bottle",
    "defectType": "broken_large"
  },
  {
    "filename": "inspect-bottle-broken-large-009.png",
    "name": "Bottle - Large Break · 009",
    "label": "anomaly",
    "category": "bottle-broken_large",
    "product": "bottle",
    "defectType": "broken_large"
  },
  {
    "filename": "inspect-bottle-broken-large-011.png",
    "name": "Bottle - Large Break · 011",
    "label": "anomaly",
    "category": "bottle-broken_large",
    "product": "bottle",
    "defectType": "broken_large"
  },
  {
    "filename": "inspect-bottle-broken-large-013.png",
    "name": "Bottle - Large Break · 013",
    "label": "anomaly",
    "category": "bottle-broken_large",
    "product": "bottle",
    "defectType": "broken_large"
  },
  {
    "filename": "inspect-bottle-broken-large-015.png",
    "name": "Bottle - Large Break · 015",
    "label": "anomaly",
    "category": "bottle-broken_large",
    "product": "bottle",
    "defectType": "broken_large"
  },
  {
    "filename": "inspect-bottle-broken-large-017.png",
    "name": "Bottle - Large Break · 017",
    "label": "anomaly",
    "category": "bottle-broken_large",
    "product": "bottle",
    "defectType": "broken_large"
  },
  {
    "filename": "inspect-bottle-broken-large-019.png",
    "name": "Bottle - Large Break · 019",
    "label": "anomaly",
    "category": "bottle-broken_large",
    "product": "bottle",
    "defectType": "broken_large"
  },
  {
    "filename": "inspect-bottle-broken-small-000.png",
    "name": "Bottle - Small Break · 000",
    "label": "anomaly",
    "category": "bottle-broken_small",
    "product": "bottle",
    "defectType": "broken_small"
  },
  {
    "filename": "inspect-bottle-broken-small-001.png",
    "name": "Bottle - Small Break · 001",
    "label": "anomaly",
    "category": "bottle-broken_small",
    "product": "bottle",
    "defectType": "broken_small"
  },
  {
    "filename": "inspect-bottle-broken-small-002.png",
    "name": "Bottle - Small Break · 002",
    "label": "anomaly",
    "category": "bottle-broken_small",
    "product": "bottle",
    "defectType": "broken_small"
  },
  {
    "filename": "inspect-bottle-broken-small-004.png",
    "name": "Bottle - Small Break · 004",
    "label": "anomaly",
    "category": "bottle-broken_small",
    "product": "bottle",
    "defectType": "broken_small"
  },
  {
    "filename": "inspect-bottle-broken-small-006.png",
    "name": "Bottle - Small Break · 006",
    "label": "anomaly",
    "category": "bottle-broken_small",
    "product": "bottle",
    "defectType": "broken_small"
  },
  {
    "filename": "inspect-bottle-broken-small-008.png",
    "name": "Bottle - Small Break · 008",
    "label": "anomaly",
    "category": "bottle-broken_small",
    "product": "bottle",
    "defectType": "broken_small"
  },
  {
    "filename": "inspect-bottle-broken-small-010.png",
    "name": "Bottle - Small Break · 010",
    "label": "anomaly",
    "category": "bottle-broken_small",
    "product": "bottle",
    "defectType": "broken_small"
  },
  {
    "filename": "inspect-bottle-broken-small-012.png",
    "name": "Bottle - Small Break · 012",
    "label": "anomaly",
    "category": "bottle-broken_small",
    "product": "bottle",
    "defectType": "broken_small"
  },
  {
    "filename": "inspect-bottle-broken-small-014.png",
    "name": "Bottle - Small Break · 014",
    "label": "anomaly",
    "category": "bottle-broken_small",
    "product": "bottle",
    "defectType": "broken_small"
  },
  {
    "filename": "inspect-bottle-broken-small-016.png",
    "name": "Bottle - Small Break · 016",
    "label": "anomaly",
    "category": "bottle-broken_small",
    "product": "bottle",
    "defectType": "broken_small"
  },
  {
    "filename": "inspect-bottle-broken-small-018.png",
    "name": "Bottle - Small Break · 018",
    "label": "anomaly",
    "category": "bottle-broken_small",
    "product": "bottle",
    "defectType": "broken_small"
  },
  {
    "filename": "inspect-bottle-broken-small-020.png",
    "name": "Bottle - Small Break · 020",
    "label": "anomaly",
    "category": "bottle-broken_small",
    "product": "bottle",
    "defectType": "broken_small"
  },
  {
    "filename": "inspect-bottle-contamination-000.png",
    "name": "Bottle - Contamination · 000",
    "label": "anomaly",
    "category": "bottle-contamination",
    "product": "bottle",
    "defectType": "contamination"
  },
  {
    "filename": "inspect-bottle-contamination-001.png",
    "name": "Bottle - Contamination · 001",
    "label": "anomaly",
    "category": "bottle-contamination",
    "product": "bottle",
    "defectType": "contamination"
  },
  {
    "filename": "inspect-bottle-contamination-002.png",
    "name": "Bottle - Contamination · 002",
    "label": "anomaly",
    "category": "bottle-contamination",
    "product": "bottle",
    "defectType": "contamination"
  },
  {
    "filename": "inspect-bottle-contamination-003.png",
    "name": "Bottle - Contamination · 003",
    "label": "anomaly",
    "category": "bottle-contamination",
    "product": "bottle",
    "defectType": "contamination"
  },
  {
    "filename": "inspect-bottle-contamination-005.png",
    "name": "Bottle - Contamination · 005",
    "label": "anomaly",
    "category": "bottle-contamination",
    "product": "bottle",
    "defectType": "contamination"
  },
  {
    "filename": "inspect-bottle-contamination-007.png",
    "name": "Bottle - Contamination · 007",
    "label": "anomaly",
    "category": "bottle-contamination",
    "product": "bottle",
    "defectType": "contamination"
  },
  {
    "filename": "inspect-bottle-contamination-009.png",
    "name": "Bottle - Contamination · 009",
    "label": "anomaly",
    "category": "bottle-contamination",
    "product": "bottle",
    "defectType": "contamination"
  },
  {
    "filename": "inspect-bottle-contamination-011.png",
    "name": "Bottle - Contamination · 011",
    "label": "anomaly",
    "category": "bottle-contamination",
    "product": "bottle",
    "defectType": "contamination"
  },
  {
    "filename": "inspect-bottle-contamination-013.png",
    "name": "Bottle - Contamination · 013",
    "label": "anomaly",
    "category": "bottle-contamination",
    "product": "bottle",
    "defectType": "contamination"
  },
  {
    "filename": "inspect-bottle-contamination-015.png",
    "name": "Bottle - Contamination · 015",
    "label": "anomaly",
    "category": "bottle-contamination",
    "product": "bottle",
    "defectType": "contamination"
  },
  {
    "filename": "inspect-bottle-contamination-017.png",
    "name": "Bottle - Contamination · 017",
    "label": "anomaly",
    "category": "bottle-contamination",
    "product": "bottle",
    "defectType": "contamination"
  }
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function listCatalogSamples(): InspectionSample[] {
  return INSPECTION_CATALOG.map((entry, index) => ({
    id: `curated-${index}-${slugify(entry.name)}`,
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
