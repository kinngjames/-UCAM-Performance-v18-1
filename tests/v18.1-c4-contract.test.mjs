import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { characterizeBlock2C4Contract } from "../scripts/block2-c4-contract.mjs";
import { withCurrentMetricsEngine } from "../scripts/metrics-characterization.mjs";

const domainPromise = withCurrentMetricsEngine(({ domain }) => domain);
const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const thresholds = {
  baselineWeeks: 8,
  criticalSleep: 6.5,
  highFatigue: 4,
  highRpe: 8,
  highStress: 4,
  lowMood: 2,
  lowSleep: 8,
  relevantPain: 4,
  zScore: 1.5,
};

const rpeSignals = async ({ avgRpe, personalRpe, zRpe }) => {
  const { deriveMetricSignals } = await domainPromise;
  return deriveMetricSignals({
    avgRpe,
    personalRpe,
    personalSleep: null,
    recordCompleteness: "COMPLETE",
    sleepSd: 0,
    thresholds,
    weekly: undefined,
    zRpe,
  }).signals.map((signal) => signal.key);
};

test("C4 frontera 1: la SD muestral divide entre n−1", async () => {
  const { sampleStandardDeviation } = await domainPromise;
  assert.equal(sampleStandardDeviation([1, 2, 3]), 1);
});

test("C4 frontera 2: menos de cinco registros no crean baseline", async () => {
  const { BASELINE_MINIMUM, personalBaseline } = await domainPromise;
  assert.equal(BASELINE_MINIMUM, 5);
  assert.equal(personalBaseline([6, 6.1, 6.2, 6.3], BASELINE_MINIMUM), null);
});

test("C4 frontera 3: una observación no estima SD", async () => {
  const { personalBaseline, sampleStandardDeviation } = await domainPromise;
  assert.equal(sampleStandardDeviation([6]), null);
  assert.equal(personalBaseline([6], 1), null);
});

test("C4 frontera 4: SD cero produce z null", async () => {
  const { personalBaseline, zScore } = await domainPromise;
  const baseline = personalBaseline([6, 6, 6, 6, 6], 5);
  assert.ok(baseline);
  assert.equal(baseline.sd, 0);
  assert.equal(zScore(6.5, baseline), null);
});

test("C4 frontera 5: el histórico discontinuo conserva los cinco valores válidos", async () => {
  const { personalBaseline } = await domainPromise;
  const baseline = personalBaseline([6, null, 6.3, undefined, 6, 6.3, 6], 5);
  assert.ok(baseline);
  assert.equal(baseline.mean, 6.12);
  assert.ok(Math.abs(baseline.sd - Math.sqrt(0.027)) < 1e-12);
});

test("C4 frontera 6: null y no finitos se excluyen sin imputar cero", async () => {
  const { personalBaseline } = await domainPromise;
  const clean = personalBaseline([6, 6.1, 6.2, 6.3, 6.4], 5);
  const dirty = personalBaseline(
    [null, 6, Number.NaN, 6.1, undefined, 6.2, Number.POSITIVE_INFINITY, 6.3, 6.4],
    5,
  );
  assert.deepEqual(dirty, clean);
});

test("C4 frontera 7: delta 0,49 no genera señal aunque el z sea alto", async () => {
  assert.deepEqual(
    await rpeSignals({ avgRpe: 6.49, personalRpe: 6, zRpe: 3 }),
    [],
  );
});

test("C4 frontera 8: delta 0,50 sí puede señalar con z suficiente", async () => {
  assert.deepEqual(
    await rpeSignals({ avgRpe: 6.5, personalRpe: 6, zRpe: 1.5 }),
    ["rpe-z"],
  );
});

test("C4 frontera 9: un z alto no sustituye el delta mínimo", async () => {
  assert.deepEqual(
    await rpeSignals({ avgRpe: 7.49, personalRpe: 7, zRpe: 10 }),
    [],
  );
});

test("C4 frontera 10: delta suficiente no sustituye el z mínimo", async () => {
  assert.deepEqual(
    await rpeSignals({ avgRpe: 6.5, personalRpe: 6, zRpe: 1.49 }),
    [],
  );
});

test("C4 mantiene el delta direccional y no crea señal por RPE bajo", async () => {
  assert.deepEqual(
    await rpeSignals({ avgRpe: 5.5, personalRpe: 6, zRpe: 3 }),
    [],
  );
});

test("C4 coincide exactamente con la matriz aprobada", async () => {
  const result = await characterizeBlock2C4Contract();
  assert.equal(result.demo.metrics, 760);
  assert.equal(result.fixture.metrics, 10);
  assert.deepEqual(result.demo.changedFields, {
    reasons: 4,
    rpeRange: 323,
    signals: 53,
    sleepRange: 154,
    status: 4,
    zRpe: 612,
    zSleep: 616,
  });
  assert.equal(result.demo.immutableDifferences, 0);
  assert.equal(result.fixture.immutableDifferences, 0);
  assert.equal(result.demo.unexpectedDifferences, 0);
  assert.equal(result.fixture.unexpectedDifferences, 0);
  assert.equal(result.demo.personalRpeDifferences, 0);
  assert.equal(result.demo.personalSleepDifferences, 0);
  assert.deepEqual(result.demo.rpeSignals, { after: 49, before: 53 });
  assert.deepEqual(result.demo.sleepSignals, { after: 47, before: 47 });
  assert.equal(result.demo.signals, 105);
  assert.deepEqual(result.demo.status, {
    OK: 663,
    REVISAR: 7,
    VIGILAR: 86,
    null: 4,
  });
  assert.deepEqual(result.causality, {
    baselineMinimum: 5,
    baselineWindow: 8,
    meanDifferences: 0,
    observationSetDifferences: 0,
    rpeMinimumDelta: 0.5,
    sdDenominatorAfter: "n-1",
    sdDenominatorBefore: "N",
  });
});

test("C4 mantiene una sola ruta estadística y una sola constante 0,5", async () => {
  const [constants, primitives, signals, orchestrator] = await Promise.all([
    read("../domain/metrics/constants.ts"),
    read("../domain/metrics/primitives.ts"),
    read("../domain/metrics/signals.ts"),
    read("../domain/metrics/build-metrics.ts"),
  ]);
  const domainSource = [constants, primitives, signals, orchestrator].join("\n");
  assert.equal((domainSource.match(/\b0\.5\b/g) ?? []).length, 1);
  assert.match(constants, /BASELINE_WINDOW = 8/);
  assert.match(constants, /BASELINE_MINIMUM = 5/);
  assert.match(constants, /RPE_MIN_MEANINGFUL_DELTA = 0\.5/);
  assert.match(primitives, /const sd = sampleStandardDeviation\(valid\)/);
  assert.match(orchestrator, /history\.slice\(-BASELINE_WINDOW\)/);
  assert.match(orchestrator, /personalBaseline\(priorRpe, BASELINE_MINIMUM\)/);
  assert.match(orchestrator, /personalBaseline\(priorSleep, BASELINE_MINIMUM\)/);
  assert.doesNotMatch(orchestrator, /thresholds\.baselineWeeks/);
  assert.match(
    signals,
    /avgRpe - personalRpe >= RPE_MIN_MEANINGFUL_DELTA/,
  );
  assert.doesNotMatch(signals, /Math\.abs\([^)]*avgRpe/);
});
