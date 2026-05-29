/** Category accepted by POST /predict in this V1 bottle-only demo. */
export const API_CATEGORIES = ["bottle"] as const;

export type ApiCategory = (typeof API_CATEGORIES)[number];

export const SUPPORTED_API_CATEGORIES = API_CATEGORIES;

export const DEFAULT_API_CATEGORY: ApiCategory = "bottle";

export const DEMO_API_CATEGORY: ApiCategory = "bottle";

export const API_CATEGORY_LABELS: Record<ApiCategory, string> = {
  bottle: "Bottle",
};

export function normalizeCategory(category: unknown): string {
  return String(category ?? "")
    .toLowerCase()
    .trim()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");
}

export function isApiCategory(value: string): value is ApiCategory {
  return (API_CATEGORIES as readonly string[]).includes(value);
}

export function isSupportedCategory(category: unknown): category is ApiCategory {
  return isApiCategory(normalizeCategory(category));
}

export function isSampleApiSupported(
  sample?: { metadata?: Record<string, unknown>; category?: string; source?: string } | null,
): boolean {
  if (!sample) return false;
  if (sample.source === "upload") return true;
  return resolveSampleApiCategory(sample) === DEMO_API_CATEGORY;
}

/** Resolve API category from catalog sample metadata — bottle demo only. */
export function resolveSampleApiCategory(
  sample?: { metadata?: Record<string, unknown>; category?: string } | null,
): ApiCategory | null {
  if (!sample) return null;

  const product = sample.metadata?.product;
  if (typeof product === "string" && normalizeCategory(product) === DEMO_API_CATEGORY) {
    return DEMO_API_CATEGORY;
  }

  if (sample.category?.startsWith("bottle")) {
    return DEMO_API_CATEGORY;
  }

  return null;
}

/**
 * Category sent to POST /predict — always bottle in this demo.
 */
export function resolveApiCategoryForRequest(
  sample: { metadata?: Record<string, unknown>; category?: string; source?: string },
  _manualCategory?: ApiCategory | null,
): ApiCategory {
  void sample;
  void _manualCategory;
  return DEMO_API_CATEGORY;
}

export const UNSUPPORTED_CATEGORY_MESSAGE = "Unsupported category for this model";
