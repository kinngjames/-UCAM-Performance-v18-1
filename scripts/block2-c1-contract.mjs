import assert from "node:assert/strict";
import { serializeCanonicalJson } from "./canonical-json.mjs";
import {
  readVerifiedV18AdversarialFixture,
  runCurrentMetricsOnV18AdversarialFixture,
} from "./v18-adversarial.mjs";
import { buildV18Baseline, V18_DATASET_SHA256 } from "./v18-baseline.mjs";
import { readVerifiedV18GoldenV2 } from "./v18-golden.mjs";

export const C1_IMMUTABLE_FIELDS = [
  "weekId",
  "playerId",
  "trainingLoad",
  "matchLoad",
  "compensatoryLoad",
  "load",
  "minutes",
  "loadCompleteness",
  "availability",
  "trained",
  "completed",
  "rpeExpected",
  "rpeCompleted",
  "wellbeingDone",
  "sleep",
  "mood",
  "fatigue",
  "pain",
  "stress",
];

const metricKey = (metric) => `${metric.weekId}-${metric.playerId}`;

const expectedWellbeing = (availability) =>
  availability === "NO DISPONIBLE" || availability === "AUSENTE" ? 0 : 1;

const expectedPending = (metric, wellbeingExpected) =>
  Math.max(0, metric.rpeExpected - metric.rpeCompleted) +
  (wellbeingExpected === 1 && !metric.wellbeingDone ? 1 : 0);

export const buildC1ExpectedMetric = (historical, hasWellbeingRecord) => {
  const expected = structuredClone(historical);
  delete expected.compliance;
  delete expected.streak;
  expected.wellbeingExpected = expectedWellbeing(expected.availability);
  const pendingBefore = expected.pending;
  expected.pending = expectedPending(expected, expected.wellbeingExpected);

  const pendingSignal = expected.signals.find((signal) => signal.key === "pending");
  if (expected.pending === 0) {
    expected.signals = expected.signals.filter((signal) => signal.key !== "pending");
    expected.reasons = expected.signals.map((signal) => signal.label);
  } else if (pendingSignal) {
    pendingSignal.reference =
      expected.wellbeingExpected === 0
        ? "Bienestar opcional"
        : `Bienestar ${expected.wellbeingDone ? "completo" : "pendiente"}`;
    pendingSignal.difference = `${expected.pending} pendiente${expected.pending > 1 ? "s" : ""}`;
  }

  if (pendingBefore !== expected.pending) {
    const review = expected.signals.some((signal) => signal.severity === "review");
    const watch = expected.signals.some((signal) => signal.severity === "watch");
    expected.status = review
      ? "REVISAR"
      : expected.pending > 0
        ? "INCOMPLETO"
        : watch
          ? "VIGILAR"
          : !expected.trained && !hasWellbeingRecord
            ? "SIN DATOS"
            : "OK";
  }
  return expected;
};

export const topLevelDifferences = (expected, actual) => {
  const fields = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  return [...fields].filter((field) => {
    const expectedHasField = Object.hasOwn(expected, field);
    const actualHasField = Object.hasOwn(actual, field);
    if (expectedHasField !== actualHasField) return true;
    return (
      serializeCanonicalJson(expected[field]) !==
      serializeCanonicalJson(actual[field])
    );
  });
};

const verifyCollection = (label, historical, actual, wellbeingRows) => {
  assert.equal(actual.length, historical.length, `${label}: longitud`);
  const currentByKey = new Map(actual.map((metric) => [metricKey(metric), metric]));
  const wellbeingKeys = new Set(
    wellbeingRows.map((row) => `${row.weekId}-${row.playerId}`),
  );
  let immutableDifferences = 0;
  let pendingChanges = 0;
  let statusChanges = 0;
  let signalChanges = 0;
  let reasonChanges = 0;

  for (const oldMetric of historical) {
    const key = metricKey(oldMetric);
    const currentMetric = currentByKey.get(key);
    assert.ok(currentMetric, `${label}: falta ${key}`);
    for (const field of C1_IMMUTABLE_FIELDS) {
      if (!Object.is(currentMetric[field], oldMetric[field])) {
        immutableDifferences += 1;
      }
    }
    const expected = buildC1ExpectedMetric(oldMetric, wellbeingKeys.has(key));
    const unexpected = topLevelDifferences(expected, currentMetric);
    assert.deepEqual(unexpected, [], `${label}: diferencias no autorizadas en ${key}`);
    assert.equal(
      serializeCanonicalJson(currentMetric),
      serializeCanonicalJson(expected),
      `${label}: salida C1 incorrecta en ${key}`,
    );
    pendingChanges += Number(oldMetric.pending !== currentMetric.pending);
    statusChanges += Number(oldMetric.status !== currentMetric.status);
    signalChanges += Number(
      serializeCanonicalJson(oldMetric.signals) !==
        serializeCanonicalJson(currentMetric.signals),
    );
    reasonChanges += Number(
      serializeCanonicalJson(oldMetric.reasons) !==
        serializeCanonicalJson(currentMetric.reasons),
    );
  }

  assert.equal(immutableDifferences, 0, `${label}: inmutables`);
  return {
    metrics: actual.length,
    removedCompliance: actual.length,
    removedStreak: actual.length,
    addedWellbeingExpected: actual.length,
    pendingChanges,
    statusChanges,
    signalChanges,
    reasonChanges,
    immutableDifferences,
    unexpectedDifferences: 0,
  };
};

export const administrativeCompleteness = (metric) => {
  const expected = metric.rpeExpected + metric.wellbeingExpected;
  const completed =
    metric.rpeCompleted +
    Number(metric.wellbeingExpected === 1 && metric.wellbeingDone);
  if (expected === 0) return "NOT_EXPECTED";
  if (completed === expected) return "COMPLETE";
  if (completed > 0) return "PARTIAL";
  return "NO_DATA";
};

export const buildC1ExpectedCollection = (historical, wellbeingRows) => {
  const wellbeingKeys = new Set(
    wellbeingRows.map((row) => `${row.weekId}-${row.playerId}`),
  );
  return historical.map((metric) =>
    buildC1ExpectedMetric(metric, wellbeingKeys.has(metricKey(metric))),
  );
};

export async function characterizeBlock2C1Contract() {
  const historicalGolden = await readVerifiedV18GoldenV2();
  const currentDemo = await buildV18Baseline();
  assert.equal(currentDemo.datasetSha256, V18_DATASET_SHA256);
  const historicalFixture = await readVerifiedV18AdversarialFixture();
  const expectedDemo = buildC1ExpectedCollection(
    historicalGolden.metrics,
    currentDemo.inputs.wellbeing,
  );
  const expectedFixture = buildC1ExpectedCollection(
    historicalFixture.output,
    historicalFixture.input.wellbeing,
  );
  return {
    demo: verifyCollection(
      "Contrato DEMO C1",
      historicalGolden.metrics,
      expectedDemo,
      currentDemo.inputs.wellbeing,
    ),
    fixture: verifyCollection(
      "Contrato fixture C1",
      historicalFixture.output,
      expectedFixture,
      historicalFixture.input.wellbeing,
    ),
  };
}

export async function verifyBlock2C1Contract() {
  const historicalGolden = await readVerifiedV18GoldenV2();
  const currentDemo = await buildV18Baseline();
  assert.equal(currentDemo.datasetSha256, V18_DATASET_SHA256);
  const historicalFixture = await readVerifiedV18AdversarialFixture();
  const currentFixture = await runCurrentMetricsOnV18AdversarialFixture();

  const demo = verifyCollection(
    "DEMO C1",
    historicalGolden.metrics,
    currentDemo.metrics,
    currentDemo.inputs.wellbeing,
  );
  const fixture = verifyCollection(
    "Fixture C1",
    historicalFixture.output,
    currentFixture.output,
    historicalFixture.input.wellbeing,
  );

  const wellbeingNotExpected = currentDemo.metrics.filter(
    (metric) => metric.wellbeingExpected === 0,
  );
  const recordNotExpected = wellbeingNotExpected.filter(
    (metric) => administrativeCompleteness(metric) === "NOT_EXPECTED",
  );
  const exposed = wellbeingNotExpected.filter(
    (metric) => metric.rpeExpected + metric.wellbeingExpected > 0,
  );
  assert.equal(wellbeingNotExpected.length, 6);
  assert.equal(recordNotExpected.length, 4);
  assert.deepEqual(exposed.map(metricKey), ["12-P05", "27-P14"]);

  const preGate = exposed.map((metric) => ({
    availability: metric.availability,
    key: metricKey(metric),
    recordCompleteness: administrativeCompleteness(metric),
    rpeExpected: metric.rpeExpected,
    sessions: currentDemo.inputs.sessions
      .filter(
        (session) =>
          session.weekId === metric.weekId &&
          session.playerId === metric.playerId,
      )
      .sort((left, right) => left.session - right.session)
      .map(({ attendance, minutes, rpe, session }) => ({
        attendance,
        minutes,
        rpe,
        session,
      })),
    wellbeingExpected: metric.wellbeingExpected,
  }));

  return {
    datasetSha256: currentDemo.datasetSha256,
    demo: {
      ...demo,
      signalsBefore: historicalGolden.metrics.reduce(
        (total, metric) => total + metric.signals.length,
        0,
      ),
      signalsAfter: currentDemo.metrics.reduce(
        (total, metric) => total + metric.signals.length,
        0,
      ),
      wellbeingExpectedZero: wellbeingNotExpected.length,
      recordCompletenessNotExpected: recordNotExpected.length,
    },
    fixture,
    preGate,
  };
}
