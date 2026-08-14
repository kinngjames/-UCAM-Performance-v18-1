import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transform } from "esbuild";
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

const loadCentralMetrics = async () => {
  const source = await readFile(
    new URL("../lib/metrics.ts", import.meta.url),
    "utf8",
  );
  const compiled = await transform(source, { loader: "ts", format: "esm" });
  return import(
    `data:text/javascript;base64,${Buffer.from(compiled.code).toString("base64")}`
  );
};

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

test("strain coincide por las dos rutas en las 760 métricas", async () => {
  const [{ inputs, metrics }, central] = await Promise.all([
    buildV18Baseline(),
    loadCentralMetrics(),
  ]);
  assert.equal(metrics.length, 760);
  assert.equal(
    metrics.reduce((total, metric) => total + metric.signals.length, 0),
    114,
  );

  for (const metric of metrics) {
    const completeRows = inputs.sessions.filter(
      (item) =>
        item.playerId === metric.playerId &&
        item.weekId === metric.weekId &&
        item.attendance === "ENTRENÓ" &&
        item.rpe != null &&
        item.minutes != null,
    );
    const sessionLoads = [1, 2, 3, 4].map((session) =>
      completeRows
        .filter((item) => item.session === session)
        .reduce(
          (total, item) =>
            total + central.loadForCompleteEffort(item.rpe, item.minutes),
          0,
        ),
    );
    const daily = [
      ...sessionLoads,
      metric.matchLoad,
      metric.compensatoryLoad,
      0,
    ];
    const directLoad = central.weeklyLoad(daily);
    const direct = central.monotonyAndStrain(daily);
    const roundedMonotony =
      direct.monotony == null
        ? null
        : Math.round(direct.monotony * 100) / 100;
    const roundedStrain =
      direct.strain == null ? null : Math.round(direct.strain);

    assert.equal(directLoad, metric.load, `${metric.weekId}-${metric.playerId}`);
    assert.equal(
      roundedMonotony,
      metric.monotony,
      `${metric.weekId}-${metric.playerId}`,
    );
    assert.equal(
      roundedStrain,
      metric.strain,
      `${metric.weekId}-${metric.playerId}`,
    );
  }
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
