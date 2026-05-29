/**
 * Validates API category resolution for the bottle-only demo.
 * Run: npm run test:categories
 */

import {
  DEMO_API_CATEGORY,
  isSampleApiSupported,
  isSupportedCategory,
  normalizeCategory,
  resolveApiCategoryForRequest,
  resolveSampleApiCategory,
} from "../src/config/api-categories";
import type { InspectionSample } from "../src/types/inspection";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`✗ ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}

function makeSample(product: string): InspectionSample {
  return {
    id: `sample-${product}`,
    name: product,
    filename: `${product}.png`,
    imageUrl: `/api/samples/${product}.png`,
    source: "curated",
    category: `${product}-good`,
    metadata: { product },
  };
}

function main(): void {
  assert(isSupportedCategory("bottle"), "bottle is supported");
  assert(!isSupportedCategory("hazelnut"), "hazelnut is not exposed in the demo");
  assert(!isSupportedCategory("cable"), "cable is not supported");
  assert(!isSupportedCategory("toothbrush"), "toothbrush is not supported");

  assert(resolveSampleApiCategory(makeSample("bottle")) === "bottle", "bottle resolves to bottle");
  assert(resolveSampleApiCategory(makeSample("hazelnut")) == null, "hazelnut does not resolve");
  assert(!isSampleApiSupported(makeSample("hazelnut")), "hazelnut sample is excluded from demo");
  assert(
    resolveApiCategoryForRequest(makeSample("hazelnut")) === DEMO_API_CATEGORY,
    "requests always send bottle category",
  );

  console.log("\nAll API category checks passed.");
}

main();
