/**
 * Pass samples flagged as anomaly in the demo — excluded from the navigator only.
 * Matched from user screenshots (#001, #005, #007, #011, #013, #016).
 */
export const EXCLUDED_PASS_FILENAMES = new Set([
  "inspect-bottle-good-a.png", // Pass · 006 — #001
  "inspect-bottle-good-000.png", // Pass · 000 — #005
  "inspect-bottle-good-002.png", // Pass · 002 — #007
  "inspect-bottle-good-007.png", // Pass · 007 — #011
  "inspect-bottle-good-011.png", // Pass · 011 — #013
  "inspect-bottle-good-013.png", // (same MVTec id family as screenshot #013)
  "inspect-bottle-good-019.png", // Pass · 019 — #016
]);

export const EXCLUDED_PASS_SOURCE_IDS = new Set([
  "006", // good-a
  "000",
  "002",
  "007",
  "011",
  "013",
  "019",
]);
