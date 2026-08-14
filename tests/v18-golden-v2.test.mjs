import assert from "node:assert/strict";
import test from "node:test";
import { serializeCanonicalJson, sha256Utf8 } from "../scripts/canonical-json.mjs";
import { withCurrentMetricsEngine } from "../scripts/metrics-characterization.mjs";
import {
  assertV18DatasetSha,
  buildV18Baseline,
  V18_DATASET_SHA256,
} from "../scripts/v18-baseline.mjs";
import {
  readV18GoldenV2,
  readVerifiedV18GoldenV2,
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

test("el golden v18 histórico conserva bytes canónicos y hash", async () => {
  const [verified, stored] = await Promise.all([
    readVerifiedV18GoldenV2(),
    readV18GoldenV2(),
  ]);
  assert.equal(verified.contents, stored);
  assert.equal(sha256Utf8(stored), V18_GOLDEN_V2_SHA256);
});

test("el golden v18 conserva las métricas históricas retiradas sin reactivar su cálculo", async () => {
  const [{ metrics }, domain] = await Promise.all([
    readVerifiedV18GoldenV2(),
    withCurrentMetricsEngine(({ domain }) => domain),
  ]);
  assert.equal(metrics.length, 760);
  assert.equal(metrics.filter((metric) => metric.monotony != null).length, 756);
  assert.equal(metrics.filter((metric) => metric.strain != null).length, 756);
  assert.equal("monotonyAndStrain" in domain, false);
});

test("seis cambios semánticos distintos alteran el hash y no mutan el original", async () => {
  const { metrics } = await readVerifiedV18GoldenV2();
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
