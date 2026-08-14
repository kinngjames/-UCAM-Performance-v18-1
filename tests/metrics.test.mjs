import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { withCurrentMetricsEngine } from "../scripts/metrics-characterization.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const metricsPromise = withCurrentMetricsEngine(({ domain }) => domain);

const emptyBuildInput = (calendar) => ({
  availability: [],
  calendar,
  matches: [],
  players: [],
  sessions: [],
  thresholds: {
    baselineWeeks: 8,
    criticalSleep: 6.5,
    highFatigue: 4,
    highMonotony: 2,
    highRpe: 8,
    highStress: 4,
    lowMood: 2,
    lowSleep: 8,
    relevantPain: 4,
    zScore: 1.5,
  },
  wellbeing: [],
});

test("buildMetrics acepta un calendario válido", async () => {
  const { buildMetrics } = await metricsPromise;
  const metrics = buildMetrics(emptyBuildInput([{ id: 1 }, { id: 2 }]));
  assert.equal(metrics.size, 0);
});

test("buildMetrics rechaza un calendario vacío", async () => {
  const { buildMetrics } = await metricsPromise;
  assert.throws(
    () => buildMetrics(emptyBuildInput([])),
    /METRICS_CALENDAR_EMPTY/,
  );
});

test("buildMetrics rechaza un ID de calendario inválido", async () => {
  const { buildMetrics } = await metricsPromise;
  assert.throws(
    () => buildMetrics(emptyBuildInput([{ id: 0 }])),
    /METRICS_CALENDAR_INVALID_ID/,
  );
});

test("buildMetrics rechaza IDs de calendario duplicados", async () => {
  const { buildMetrics } = await metricsPromise;
  assert.throws(
    () => buildMetrics(emptyBuildInput([{ id: 1 }, { id: 1 }])),
    /METRICS_CALENDAR_DUPLICATE_ID/,
  );
});

test("buildMetrics rechaza un calendario desordenado", async () => {
  const { buildMetrics } = await metricsPromise;
  assert.throws(
    () => buildMetrics(emptyBuildInput([{ id: 2 }, { id: 1 }])),
    /METRICS_CALENDAR_NOT_STRICTLY_INCREASING/,
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

test("la SD poblacional permanece aislada de los baselines personales", async () => {
  const { standardDeviation } = await metricsPromise;
  assert.equal(standardDeviation([]), 0);
  assert.equal(standardDeviation([4]), 0);
  assert.equal(standardDeviation([4, 4, 4]), 0);
  assert.ok(
    Math.abs(standardDeviation([1, 2, 3]) - Math.sqrt(2 / 3)) <
      Number.EPSILON,
  );
});

test("la SD muestral usa n−1 y no estima con una observación", async () => {
  const { sampleStandardDeviation } = await metricsPromise;
  assert.equal(sampleStandardDeviation([]), null);
  assert.equal(sampleStandardDeviation([4]), null);
  assert.equal(sampleStandardDeviation([4, 4, 4]), 0);
  assert.ok(
    Math.abs(sampleStandardDeviation([1, 2, 3]) - 1) < Number.EPSILON,
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
  assert.ok(Math.abs(baseline.sd - Math.sqrt(0.025)) < 1e-12);
  assert.deepEqual(baseline.range, [
    baseline.mean - baseline.sd,
    baseline.mean + baseline.sd,
  ]);
  assert.ok(Math.abs(zScore(7.4, baseline) - Math.sqrt(1.6)) < 1e-12);
  assert.equal(zScore(null, baseline), null);
  assert.equal(zScore(7, personalBaseline([7, 7, 7, 7, 7], 5)), null);
  assert.equal(personalBaseline([7], 1), null);

  const finiteOnly = personalBaseline(
    [7, Number.NaN, 7.2, Number.POSITIVE_INFINITY, 7.4, 7.1, 7.3],
    5,
  );
  assert.deepEqual(finiteOnly, baseline);
});

test("C1 mantiene pending como recuento administrativo", async () => {
  const {
    registrationPending,
    wellbeingExpectedForAvailability,
  } = await metricsPromise;
  assert.equal(wellbeingExpectedForAvailability("COMPLETO"), 1);
  assert.equal(wellbeingExpectedForAvailability("MODIFICADO"), 1);
  assert.equal(wellbeingExpectedForAvailability("RECUPERACIÓN"), 1);
  assert.equal(wellbeingExpectedForAvailability("NO DISPONIBLE"), 0);
  assert.equal(wellbeingExpectedForAvailability("AUSENTE"), 0);
  assert.equal(
    registrationPending({
      rpeCompleted: 2,
      rpeExpected: 4,
      wellbeingDone: false,
      wellbeingExpected: 1,
    }),
    3,
  );
  assert.equal(
    registrationPending({
      rpeCompleted: 0,
      rpeExpected: 0,
      wellbeingDone: false,
      wellbeingExpected: 0,
    }),
    0,
  );
  assert.equal(
    registrationPending({
      rpeCompleted: 3,
      rpeExpected: 2,
      wellbeingDone: false,
      wellbeingExpected: 1,
    }),
    1,
  );
});

test("C6 clasifica la completitud administrativa sin contaminar monitorización", async () => {
  const { classifyRecordCompleteness } = await metricsPromise;
  assert.equal(
    classifyRecordCompleteness({
      rpeCompleted: 2,
      rpeExpected: 2,
      wellbeingDone: true,
      wellbeingExpected: 1,
    }),
    "COMPLETE",
  );
  assert.equal(
    classifyRecordCompleteness({
      rpeCompleted: 1,
      rpeExpected: 2,
      wellbeingDone: true,
      wellbeingExpected: 1,
    }),
    "PARTIAL",
  );
  assert.equal(
    classifyRecordCompleteness({
      rpeCompleted: 0,
      rpeExpected: 1,
      wellbeingDone: false,
      wellbeingExpected: 1,
    }),
    "NO_DATA",
  );
  assert.equal(
    classifyRecordCompleteness({
      rpeCompleted: 0,
      rpeExpected: 0,
      wellbeingDone: true,
      wellbeingExpected: 0,
    }),
    "NOT_EXPECTED",
  );
});

test("C6 mantiene VIGILAR cuando existe señal deportiva y pending es mayor que cero", async () => {
  const {
    classifyRecordCompleteness,
    deriveMetricSignals,
    registrationPending,
  } = await metricsPromise;
  const pending = registrationPending({
    rpeCompleted: 1,
    rpeExpected: 2,
    wellbeingDone: true,
    wellbeingExpected: 1,
  });
  const recordCompleteness = classifyRecordCompleteness({
    rpeCompleted: 1,
    rpeExpected: 2,
    wellbeingDone: true,
    wellbeingExpected: 1,
  });
  const result = deriveMetricSignals({
    avgRpe: 6.5,
    personalRpe: 6,
    personalSleep: null,
    recordCompleteness,
    sleepSd: 0,
    thresholds: emptyBuildInput([{ id: 1 }]).thresholds,
    weekly: undefined,
    zRpe: 2.33,
  });
  assert.equal(pending, 1);
  assert.equal(recordCompleteness, "PARTIAL");
  assert.deepEqual(result.signals.map((signal) => signal.key), ["rpe-z"]);
  assert.deepEqual(result.reasons, [
    "RPE por encima de su comportamiento habitual",
  ]);
  assert.equal(result.status, "VIGILAR");
});

test("C4 aplica el delta RPE inclusivo de 0,5 además del z-score", async () => {
  const { deriveMetricSignals, RPE_MIN_MEANINGFUL_DELTA } =
    await metricsPromise;
  const thresholds = emptyBuildInput([{ id: 1 }]).thresholds;
  const derive = ({ avgRpe, personalRpe, zRpe }) =>
    deriveMetricSignals({
      avgRpe,
      personalRpe,
      personalSleep: null,
      recordCompleteness: "COMPLETE",
      sleepSd: 0,
      thresholds,
      weekly: undefined,
      zRpe,
    });

  assert.equal(RPE_MIN_MEANINGFUL_DELTA, 0.5);
  assert.deepEqual(derive({ avgRpe: 6.49, personalRpe: 6, zRpe: 3 }).signals, []);
  assert.deepEqual(
    derive({ avgRpe: 6.5, personalRpe: 6, zRpe: 1.5 }).signals.map(
      (signal) => signal.key,
    ),
    ["rpe-z"],
  );
  assert.deepEqual(derive({ avgRpe: 6.49, personalRpe: 6, zRpe: 3 }).signals, []);
  assert.deepEqual(derive({ avgRpe: 6.5, personalRpe: 6, zRpe: 1.49 }).signals, []);
  assert.deepEqual(derive({ avgRpe: 5.5, personalRpe: 6, zRpe: 3 }).signals, []);
});

test("C6 permite que dolor voluntario REVISAR gane a NOT_EXPECTED", async () => {
  const { buildMetrics } = await metricsPromise;
  const metric = buildMetrics({
    ...emptyBuildInput([{ id: 1 }]),
    availability: [
      {
        note: "Sin exposición esperada",
        playerId: "VOLUNTARIO",
        value: "NO DISPONIBLE",
        weekId: 1,
      },
    ],
    players: [
      {
        accessActive: true,
        active: true,
        birthDate: "2000-01-01",
        dominantFoot: "DERECHA",
        id: "VOLUNTARIO",
        name: "REGISTRO VOLUNTARIO",
        notes: "",
        number: 1,
        position: "MEDIO",
      },
    ],
    wellbeing: [
      {
        fatigue: 2,
        mood: 4,
        notes: "Registro voluntario válido",
        pain: 5,
        playerId: "VOLUNTARIO",
        sleep: 8,
        stress: 2,
        weekId: 1,
      },
    ],
  }).get("1-VOLUNTARIO");
  assert.ok(metric);
  assert.equal(metric.wellbeingExpected, 0);
  assert.equal(metric.wellbeingDone, true);
  assert.deepEqual(
    [metric.sleep, metric.mood, metric.fatigue, metric.pain, metric.stress],
    [8, 4, 2, 5, 2],
  );
  assert.equal(metric.pending, 0);
  assert.equal(metric.recordCompleteness, "NOT_EXPECTED");
  assert.deepEqual(metric.signals.map((signal) => signal.key), ["pain"]);
  assert.deepEqual(metric.reasons, ["Dolor relevante registrado"]);
  assert.equal(metric.signals.some((signal) => signal.key === "pending"), false);
  assert.equal(metric.status, "REVISAR");
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

test("producción consume el dominio central sin copias inline", async () => {
  const [page, engine, orchestrator] = await Promise.all([
    read("../app/page.tsx"),
    read("../domain/metrics/primitives.ts"),
    read("../domain/metrics/build-metrics.ts"),
  ]);

  assert.match(page, /buildMetrics/);
  for (const primitive of [
    "meanValue as mean",
    "monotonyAndStrain",
    "personalBaseline",
    "registrationPending",
    "wellbeingExpectedForAvailability",
    "zScore",
  ]) {
    assert.match(orchestrator, new RegExp(primitive));
  }
  assert.match(page, /completeEffortProduct/);
  assert.match(page, /loadForCompleteEffort/);
  assert.doesNotMatch(page, /const\s+mean\s*=/);
  assert.doesNotMatch(page, /const\s+sd\s*=/);
  assert.doesNotMatch(page, /dailyMean|dailySd/);
  assert.doesNotMatch(page, /0\.4\s*\*\s*totalLoad/);
  assert.doesNotMatch(page, /totalLoad\s*\*\s*monotony/);
  assert.doesNotMatch(
    page,
    /Math\.round\(\s*\(\(rpeCompleted\s*\+\s*\(wellbeingDone/,
  );
  assert.doesNotMatch(page, /\bcompliancePercent\b/);
  assert.doesNotMatch(page, /\bcompliance\b/);
  assert.doesNotMatch(page, /\bstreak\b/);
  assert.doesNotMatch(page, /avgRpe\s*-\s*personalRpe/);
  assert.doesNotMatch(page, /\b(?:item|row|match)\.rpe\s*\*\s*(?:item|row|match)\.minutes/);
  assert.doesNotMatch(page, /\bloadForEffort\b/);
  assert.doesNotMatch(engine, /\bloadForEffort\b/);
  assert.doesNotMatch(orchestrator, /\bloadForEffort\b/);
  assert.doesNotMatch(orchestrator, /standardDeviation as sd/);
  assert.doesNotMatch(
    orchestrator,
    /\bnextEwma\b|plannedTrainingLoad|plannedMatchLoad|\bchronic\b|\bewma\b|\bratio\b/,
  );
  assert.equal("nextEwma" in (await metricsPromise), false);
});
