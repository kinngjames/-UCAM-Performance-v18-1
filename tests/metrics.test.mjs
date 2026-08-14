import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transform } from "esbuild";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const metricsPromise = read("../lib/metrics.ts").then(async (source) => {
  const compiled = await transform(source, { loader: "ts", format: "esm" });
  return import(
    `data:text/javascript;base64,${Buffer.from(compiled.code).toString("base64")}`
  );
});

test("la carga solo existe con RPE y minutos completos", async () => {
  const metrics = await metricsPromise;
  assert.equal(metrics.completeEffortProduct(6.3, 61), 6.3 * 61);
  assert.equal(metrics.completeEffortProduct(null, 61), null);
  assert.equal(metrics.loadForCompleteEffort(6.3, 61), 384);
  assert.equal(metrics.loadForCompleteEffort(6, 67), 402);
  assert.equal(metrics.loadForCompleteEffort(null, 67), null);
  assert.equal(metrics.loadForCompleteEffort(6, null), null);
  assert.equal(metrics.loadForCompleteEffort(undefined, 67), null);
  assert.equal(metrics.loadForCompleteEffort(6, undefined), null);
  assert.equal(metrics.loadForCompleteEffort(Number.NaN, 67), null);
  assert.equal(metrics.loadForCompleteEffort(6, Number.POSITIVE_INFINITY), null);
  assert.equal("loadForEffort" in metrics, false);
  assert.equal(metrics.weeklyLoad([300, 402, 0, 198]), 900);
});

test("la media ignora ausencias sin convertirlas en cero", async () => {
  const { meanValue } = await metricsPromise;
  assert.equal(meanValue([]), null);
  assert.equal(meanValue([null, undefined]), null);
  assert.equal(meanValue([2, null, 4, undefined]), 3);
  assert.equal(meanValue([2, Number.NaN, 4, Number.POSITIVE_INFINITY]), 3);
});

test("la desviación estándar conserva el contrato poblacional N", async () => {
  const { standardDeviation } = await metricsPromise;
  assert.equal(standardDeviation([]), 0);
  assert.equal(standardDeviation([4]), 0);
  assert.equal(standardDeviation([4, 4, 4]), 0);
  assert.ok(
    Math.abs(standardDeviation([1, 2, 3]) - Math.sqrt(2 / 3)) <
      Number.EPSILON,
  );
});

test("el baseline exige cinco registros y conserva históricos discontinuos", async () => {
  const { personalBaseline, zScore } = await metricsPromise;
  assert.equal(personalBaseline([7, 7.2, 7.4, 7.1], 5), null);
  assert.equal(
    personalBaseline([7, null, 7.2, undefined, 7.4, 7.1], 5),
    null,
  );

  const baseline = personalBaseline(
    [7, null, 7.2, undefined, 7.4, 7.1, 7.3],
    5,
  );
  assert.ok(baseline);
  assert.equal(baseline.mean, 7.2);
  assert.ok(Math.abs(baseline.sd - Math.sqrt(0.02)) < 1e-12);
  assert.deepEqual(baseline.range, [
    baseline.mean - baseline.sd,
    baseline.mean + baseline.sd,
  ]);
  assert.ok(Math.abs(zScore(7.4, baseline) - Math.sqrt(2)) < 1e-12);
  assert.equal(zScore(null, baseline), null);
  assert.equal(zScore(7, personalBaseline([7, 7, 7, 7, 7], 5)), null);
});

test("EWMA y cumplimiento conservan exactamente las fórmulas v18", async () => {
  const { compliancePercent, nextEwma } = await metricsPromise;
  assert.equal(nextEwma(100, null, 0.4), 100);
  assert.equal(nextEwma(200, 100, 0.4), 140);
  assert.equal(compliancePercent(3, 3, true), 100);
  assert.equal(compliancePercent(2, 3, false), 50);
  assert.equal(compliancePercent(0, 0, false), 0);
  assert.equal(compliancePercent(0, 0, true), 100);
});

test("monotonía y strain comparten la misma carga semanal", async () => {
  const { monotonyAndStrain } = await metricsPromise;
  assert.deepEqual(monotonyAndStrain([0, 0, 0, 0, 0, 0, 0]), {
    monotony: null,
    strain: null,
  });
  const result = monotonyAndStrain([1, 2, 3]);
  assert.ok(Math.abs(result.monotony - Math.sqrt(6)) < 1e-12);
  assert.ok(Math.abs(result.strain - 6 * Math.sqrt(6)) < 1e-12);
});

test("distingue completo, parcial, sin exposición y sin datos", async () => {
  const metrics = await metricsPromise;
  assert.equal(
    metrics.classifyLoadCompleteness({
      expectedEfforts: 4,
      completedEfforts: 4,
      explicitNoExposure: false,
    }),
    "COMPLETE",
  );
  assert.equal(
    metrics.classifyLoadCompleteness({
      expectedEfforts: 4,
      completedEfforts: 3,
      explicitNoExposure: false,
    }),
    "PARTIAL",
  );
  assert.equal(
    metrics.classifyLoadCompleteness({
      expectedEfforts: 0,
      completedEfforts: 0,
      explicitNoExposure: true,
    }),
    "NO_EXPOSURE",
  );
  assert.equal(
    metrics.classifyLoadCompleteness({
      expectedEfforts: 1,
      completedEfforts: 0,
      explicitNoExposure: false,
    }),
    "NO_DATA",
  );
  assert.deepEqual(
    metrics.summarizeLoadCoverage([
      "COMPLETE",
      "PARTIAL",
      "NO_EXPOSURE",
      "NO_DATA",
      "COMPLETE",
    ]),
    { complete: 2, partial: 1, noExposure: 1, noData: 1 },
  );
});

test("producción consume las seis primitivas centrales sin copias inline", async () => {
  const [page, engine] = await Promise.all([
    read("../app/page.tsx"),
    read("../lib/metrics.ts"),
  ]);

  for (const primitive of [
    "completeEffortProduct",
    "compliancePercent",
    "meanValue as mean",
    "monotonyAndStrain",
    "nextEwma",
    "personalBaseline",
    "standardDeviation as sd",
    "zScore",
  ]) {
    assert.match(page, new RegExp(primitive));
  }
  assert.doesNotMatch(page, /const\s+mean\s*=/);
  assert.doesNotMatch(page, /const\s+sd\s*=/);
  assert.doesNotMatch(page, /dailyMean|dailySd/);
  assert.doesNotMatch(page, /0\.4\s*\*\s*totalLoad/);
  assert.doesNotMatch(page, /totalLoad\s*\*\s*monotony/);
  assert.doesNotMatch(
    page,
    /Math\.round\(\s*\(\(rpeCompleted\s*\+\s*\(wellbeingDone/,
  );
  assert.doesNotMatch(page, /avgRpe\s*-\s*personalRpe/);
  assert.doesNotMatch(page, /\b(?:item|row|match)\.rpe\s*\*\s*(?:item|row|match)\.minutes/);
  assert.doesNotMatch(page, /\bloadForEffort\b/);
  assert.doesNotMatch(engine, /\bloadForEffort\b/);
});
