import assert from "node:assert/strict";
import { serializeCanonicalJson } from "./canonical-json.mjs";
import {
  administrativeCompleteness,
  buildC1ExpectedCollection,
  C1_IMMUTABLE_FIELDS,
  topLevelDifferences,
} from "./block2-c1-contract.mjs";
import {
  readVerifiedV18AdversarialFixture,
  runCurrentMetricsOnV18AdversarialFixture,
} from "./v18-adversarial.mjs";
import { buildV18Baseline, V18_DATASET_SHA256 } from "./v18-baseline.mjs";
import { readVerifiedV18GoldenV2 } from "./v18-golden.mjs";

const C6_ALLOWED_FIELDS = new Set([
  "recordCompleteness",
  "reasons",
  "signals",
  "status",
]);

const metricKey = (metric) => `${metric.weekId}-${metric.playerId}`;

export const buildC6ExpectedMetric = (c1Metric) => {
  const expected = structuredClone(c1Metric);
  expected.recordCompleteness = administrativeCompleteness(expected);
  expected.signals = expected.signals.filter(
    (signal) => signal.key !== "pending" && signal.severity !== "info",
  );
  expected.reasons = expected.signals.map((signal) => signal.label);
  const review = expected.signals.some(
    (signal) => signal.severity === "review",
  );
  const watch = expected.signals.some(
    (signal) => signal.severity === "watch",
  );
  expected.status = review
    ? "REVISAR"
    : watch
      ? "VIGILAR"
      : expected.recordCompleteness === "NOT_EXPECTED"
        ? null
        : "OK";
  return expected;
};

const verifyCollection = ({
  actual,
  c1Expected,
  historical,
  label,
}) => {
  assert.equal(actual.length, historical.length, `${label}: longitud`);
  const actualByKey = new Map(actual.map((metric) => [metricKey(metric), metric]));
  const c1ByKey = new Map(c1Expected.map((metric) => [metricKey(metric), metric]));
  let immutableDifferences = 0;
  let unexpectedDifferences = 0;
  const changedFields = {
    reasons: 0,
    recordCompleteness: 0,
    signals: 0,
    status: 0,
  };

  for (const historicalMetric of historical) {
    const key = metricKey(historicalMetric);
    const c1Metric = c1ByKey.get(key);
    const actualMetric = actualByKey.get(key);
    assert.ok(c1Metric, `${label}: falta estadio C1 ${key}`);
    assert.ok(actualMetric, `${label}: falta salida C6 ${key}`);
    const expectedMetric = buildC6ExpectedMetric(c1Metric);
    assert.equal(
      serializeCanonicalJson(actualMetric),
      serializeCanonicalJson(expectedMetric),
      `${label}: salida C6 incorrecta en ${key}`,
    );

    for (const field of C1_IMMUTABLE_FIELDS) {
      immutableDifferences += Number(
        !Object.is(actualMetric[field], historicalMetric[field]),
      );
    }
    const stageDifferences = topLevelDifferences(c1Metric, actualMetric);
    const unauthorized = stageDifferences.filter(
      (field) => !C6_ALLOWED_FIELDS.has(field),
    );
    unexpectedDifferences += unauthorized.length;
    assert.deepEqual(
      unauthorized,
      [],
      `${label}: diferencias fuera de contrato en ${key}`,
    );
    for (const field of Object.keys(changedFields)) {
      changedFields[field] += Number(stageDifferences.includes(field));
    }
  }

  assert.equal(immutableDifferences, 0, `${label}: campos inmutables`);
  assert.equal(unexpectedDifferences, 0, `${label}: diferencias no autorizadas`);
  return {
    changedFields,
    immutableDifferences,
    metrics: actual.length,
    unexpectedDifferences,
  };
};

const countBy = (metrics, field) =>
  Object.fromEntries(
    metrics.reduce((counts, metric) => {
      const value = metric[field] === null ? "null" : metric[field];
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map()),
  );

const metricAt = (metrics, playerId, weekId) => {
  const metric = metrics.find(
    (item) => item.playerId === playerId && item.weekId === weekId,
  );
  assert.ok(metric, `Fixture C6: falta ${weekId}-${playerId}`);
  return metric;
};

export async function verifyBlock2C6Contract() {
  const historicalGolden = await readVerifiedV18GoldenV2();
  const historicalFixture = await readVerifiedV18AdversarialFixture();
  const [currentDemo, currentFixture] = await Promise.all([
    buildV18Baseline(),
    runCurrentMetricsOnV18AdversarialFixture(),
  ]);
  assert.equal(currentDemo.datasetSha256, V18_DATASET_SHA256);

  const c1Demo = buildC1ExpectedCollection(
    historicalGolden.metrics,
    currentDemo.inputs.wellbeing,
  );
  const c1Fixture = buildC1ExpectedCollection(
    historicalFixture.output,
    historicalFixture.input.wellbeing,
  );
  const demo = verifyCollection({
    actual: currentDemo.metrics,
    c1Expected: c1Demo,
    historical: historicalGolden.metrics,
    label: "DEMO C6",
  });
  const fixture = verifyCollection({
    actual: currentFixture.output,
    c1Expected: c1Fixture,
    historical: historicalFixture.output,
    label: "Fixture C6",
  });

  const demoSignals = currentDemo.metrics.reduce(
    (total, metric) => total + metric.signals.length,
    0,
  );
  const demoStatus = countBy(currentDemo.metrics, "status");
  const demoCompleteness = countBy(currentDemo.metrics, "recordCompleteness");
  assert.equal(demoSignals, 109);
  assert.deepEqual(demoStatus, {
    OK: 659,
    REVISAR: 7,
    VIGILAR: 90,
    null: 4,
  });
  assert.deepEqual(demoCompleteness, {
    COMPLETE: 753,
    NOT_EXPECTED: 4,
    PARTIAL: 3,
  });

  const r7 = metricAt(currentFixture.output, "ADV-EDGE", 5);
  const r8 = metricAt(currentFixture.output, "ADV-EDGE", 6);
  const r10 = metricAt(currentFixture.output, "ADV-EDGE", 8);
  assert.deepEqual(
    {
      pending: r7.pending,
      reasons: r7.reasons,
      recordCompleteness: r7.recordCompleteness,
      signals: r7.signals,
      status: r7.status,
    },
    {
      pending: 1,
      reasons: [],
      recordCompleteness: "PARTIAL",
      signals: [],
      status: "OK",
    },
  );
  assert.deepEqual(
    {
      pending: r8.pending,
      reasons: r8.reasons,
      recordCompleteness: r8.recordCompleteness,
      signals: r8.signals,
      status: r8.status,
    },
    {
      pending: 0,
      reasons: [],
      recordCompleteness: "NOT_EXPECTED",
      signals: [],
      status: null,
    },
  );
  assert.deepEqual(
    {
      pending: r10.pending,
      reasons: r10.reasons,
      recordCompleteness: r10.recordCompleteness,
      signalKeys: r10.signals.map((signal) => signal.key),
      status: r10.status,
    },
    {
      pending: 1,
      reasons: ["RPE por encima de su comportamiento habitual"],
      recordCompleteness: "PARTIAL",
      signalKeys: ["rpe-z"],
      status: "VIGILAR",
    },
  );

  return {
    datasetSha256: currentDemo.datasetSha256,
    demo: {
      ...demo,
      recordCompleteness: {
        ...demoCompleteness,
        NO_DATA: demoCompleteness.NO_DATA ?? 0,
      },
      signals: demoSignals,
      status: demoStatus,
    },
    fixture: {
      ...fixture,
      rows: { R7: r7, R8: r8, R10: r10 },
    },
    historical: {
      fixtureInputSha256: historicalFixture.inputSha256,
      fixtureOutputSha256: historicalFixture.outputSha256,
      goldenSha256: historicalGolden.goldenSha256,
    },
  };
}
