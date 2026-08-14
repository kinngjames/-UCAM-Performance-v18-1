import assert from "node:assert/strict";
import test from "node:test";
import { serializeCanonicalJson, sha256Utf8 } from "../scripts/canonical-json.mjs";
import {
  assertV18DatasetSha,
  buildV18Baseline,
  V18_DATASET_SHA256,
} from "../scripts/v18-baseline.mjs";
import {
  generateV18GoldenV2,
  readV18GoldenV2,
  V18_GOLDEN_V2_SHA256,
} from "../scripts/v18-golden.mjs";

const hashMetrics = (metrics) => sha256Utf8(serializeCanonicalJson(metrics));

const mutateCopy = (metrics, mutation) => {
  const copy = structuredClone(metrics);
  mutation(copy);
  return hashMetrics(copy);
};

test("el generador aborta antes de calcular métricas si cambia el dataset", async () => {
  const baseline = await buildV18Baseline();
  assert.equal(baseline.datasetSha256, V18_DATASET_SHA256);
  assert.throws(() => assertV18DatasetSha("dataset-mutado"), /Dataset SHA/);
});

test("el golden almacenado coincide en bytes y hash con el motor v18", async () => {
  const [generated, stored] = await Promise.all([
    generateV18GoldenV2(),
    readV18GoldenV2(),
  ]);
  assert.equal(generated.contents, stored);
  assert.equal(sha256Utf8(stored), V18_GOLDEN_V2_SHA256);
});

test("seis cambios semánticos distintos alteran el hash y no mutan el original", async () => {
  const { metrics } = await generateV18GoldenV2();
  const originalHash = hashMetrics(metrics);
  const mutations = [
    mutateCopy(metrics, (copy) => {
      copy[0].compliance += 1;
    }),
    mutateCopy(metrics, (copy) => {
      copy.find((metric) => metric.ratio === null).ratio = 0;
    }),
    mutateCopy(metrics, (copy) => {
      copy[0].wellbeingDone = !copy[0].wellbeingDone;
    }),
    mutateCopy(metrics, (copy) => {
      copy.find((metric) => metric.signals.length).signals[0].explanation +=
        " [mutado]";
    }),
    mutateCopy(metrics, (copy) => {
      const metric = copy.find((item) => item.status === "OK");
      metric.status = "VIGILAR";
    }),
    mutateCopy(metrics, (copy) => {
      copy.find((metric) => metric.reasons.length).reasons.push("MUTACIÓN");
    }),
  ];

  assert.equal(new Set([originalHash, ...mutations]).size, 7);
  assert.equal(hashMetrics(metrics), originalHash);
});
