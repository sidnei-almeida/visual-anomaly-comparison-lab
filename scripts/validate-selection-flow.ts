/**
 * Validates that inspection store preserves selectedSampleId across result updates.
 * Run: npm run test:selection
 */

import { useInspectionStore, ensureDefaultSampleSelection } from "../src/store/inspection-store";
import type { InspectionResult, InspectionSample } from "../src/types/inspection";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`✗ ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}

function makeSample(index: number): InspectionSample {
  return {
    id: `curated-${index}-sample`,
    name: `Sample ${index}`,
    filename: `sample-${index}.png`,
    imageUrl: `/api/samples/sample-${index}.png`,
    source: "curated",
    metadata: { product: "bottle" },
  };
}

function makeResult(sample: InspectionSample): InspectionResult {
  return {
    sampleId: sample.id,
    sampleName: sample.name,
    verdict: "ANOMALY",
    verdictKind: "anomaly",
    status: "anomaly",
    isAnomaly: true,
    apiCategory: "bottle",
    anomalyScore: 5.0,
    scoreThreshold: 3.91,
    errorMean: 0.01,
    zMapMax: 8.0,
    scoreRatio: 5.0 / 3.91,
    imageSize: { width: 256, height: 256 },
    boxes: [],
    hasBoxes: false,
    images: { original: null, reconstruction: null, heatmap: null, mask: null },
    model: {
      experimentName: "mvtec_structured_objects_dae_v1",
      modelName: "multi_product_denoising_conv_autoencoder",
      scoreName: "top_1_z_score",
    },
    localizationNote: null,
    bboxMethod: null,
    latencyMs: 100,
    timestamp: new Date().toISOString(),
    isDemoFallback: false,
  };
}

function resetStore(): void {
  useInspectionStore.setState({
    samples: [],
    selectedSampleId: null,
    currentResult: null,
    resultsBySampleId: {},
    timeline: [],
    inspectionHistory: [],
    sequenceCounter: 0,
  });
}

function main(): void {
  resetStore();
  const s1 = makeSample(1);
  const s2 = makeSample(2);
  const s3 = makeSample(3);
  useInspectionStore.getState().setSamples([s1, s2, s3]);

  useInspectionStore.getState().selectSample(s2.id);
  assert(useInspectionStore.getState().selectedSampleId === s2.id, "selectSample sets #002 active");

  const r2 = makeResult(s2);
  useInspectionStore.getState().recordInspectionRun(r2, s2, 1);
  assert(
    useInspectionStore.getState().selectedSampleId === s2.id,
    "recordInspectionRun keeps #002 selected",
  );
  assert(
    useInspectionStore.getState().currentResult?.sampleId === s2.id,
    "currentResult reflects #002 after its inference",
  );

  const r1 = makeResult(s1);
  useInspectionStore.getState().recordInspectionRun(r1, s1, 2);
  assert(
    useInspectionStore.getState().selectedSampleId === s2.id,
    "background inference for #001 does not steal selection from #003",
  );

  useInspectionStore.getState().selectSample(s3.id);
  const r3 = makeResult(s3);
  useInspectionStore.getState().recordInspectionRun(r3, s3, 3);
  assert(
    useInspectionStore.getState().currentResult?.sampleId === s3.id,
    "currentResult stays on #003 while another sample is recorded",
  );

  const r1b = makeResult(s1);
  useInspectionStore.getState().appendBatchOutcome({
    results: [r1b],
    timelineEntries: [],
    failures: [],
  });
  assert(
    useInspectionStore.getState().selectedSampleId === s3.id,
    "appendBatchOutcome preserves selected sample during batch",
  );

  const samples = useInspectionStore.getState().samples;
  assert(
    ensureDefaultSampleSelection(samples, null) === s1.id,
    "ensureDefaultSampleSelection picks first supported sample when unset",
  );
  assert(
    ensureDefaultSampleSelection(samples, s2.id) === s2.id,
    "ensureDefaultSampleSelection keeps existing selection",
  );

  console.log("\nAll selection flow checks passed.");
}

main();
