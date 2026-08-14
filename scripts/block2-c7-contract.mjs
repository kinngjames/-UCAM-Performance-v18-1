import assert from "node:assert/strict";
import { serializeCanonicalJson } from "./canonical-json.mjs";
import {
  buildC1ExpectedCollection,
  C1_IMMUTABLE_FIELDS,
  topLevelDifferences,
} from "./block2-c1-contract.mjs";
import { buildC6ExpectedCollection } from "./block2-c6-contract.mjs";
import {
  readVerifiedV18AdversarialFixture,
  runCurrentMetricsOnV18AdversarialFixture,
} from "./v18-adversarial.mjs";
import { buildV18Baseline, V18_DATASET_SHA256 } from "./v18-baseline.mjs";
import { readVerifiedV18GoldenV2 } from "./v18-golden.mjs";

export const C7_REMOVED_METRIC_FIELDS = [
  "plannedTrainingLoad",
  "plannedTotalLoad",
  "chronic",
  "ewma",
  "ratio",
];

const C7_ALLOWED_FIELDS = new Set(C7_REMOVED_METRIC_FIELDS);
const metricKey = (metric) => `${metric.weekId}-${metric.playerId}`;

export const buildC7ExpectedMetric = (c6Metric) => {
  const expected = structuredClone(c6Metric);
  for (const field of C7_REMOVED_METRIC_FIELDS) delete expected[field];
  return expected;
};

export const buildC7ExpectedCollection = (c6Metrics) =>
  c6Metrics.map(buildC7ExpectedMetric);

const verifyCollection = ({ actual, c6Expected, historical, label }) => {
  assert.equal(actual.length, historical.length, `${label}: longitud`);
  const actualByKey = new Map(actual.map((metric) => [metricKey(metric), metric]));
  const c6ByKey = new Map(c6Expected.map((metric) => [metricKey(metric), metric]));
  const removedFields = Object.fromEntries(
    C7_REMOVED_METRIC_FIELDS.map((field) => [field, 0]),
  );
  let immutableDifferences = 0;
  let signalsDifferences = 0;
  let statusDifferences = 0;
  let unexpectedDifferences = 0;

  for (const historicalMetric of historical) {
    const key = metricKey(historicalMetric);
    const c6Metric = c6ByKey.get(key);
    const actualMetric = actualByKey.get(key);
    assert.ok(c6Metric, `${label}: falta estadio C6 ${key}`);
    assert.ok(actualMetric, `${label}: falta salida C7 ${key}`);
    const expectedMetric = buildC7ExpectedMetric(c6Metric);
    assert.equal(
      serializeCanonicalJson(actualMetric),
      serializeCanonicalJson(expectedMetric),
      `${label}: salida C7 incorrecta en ${key}`,
    );

    for (const field of C1_IMMUTABLE_FIELDS) {
      immutableDifferences += Number(
        !Object.is(actualMetric[field], historicalMetric[field]),
      );
    }
    const stageDifferences = topLevelDifferences(c6Metric, actualMetric);
    const unauthorized = stageDifferences.filter(
      (field) => !C7_ALLOWED_FIELDS.has(field),
    );
    unexpectedDifferences += unauthorized.length;
    assert.deepEqual(
      unauthorized,
      [],
      `${label}: diferencias fuera de contrato en ${key}`,
    );
    for (const field of C7_REMOVED_METRIC_FIELDS) {
      assert.equal(Object.hasOwn(c6Metric, field), true, `${label}: C6 sin ${field}`);
      assert.equal(Object.hasOwn(actualMetric, field), false, `${label}: C7 conserva ${field}`);
      removedFields[field] += Number(stageDifferences.includes(field));
    }
    signalsDifferences += Number(
      serializeCanonicalJson(actualMetric.signals) !==
        serializeCanonicalJson(c6Metric.signals),
    );
    statusDifferences += Number(actualMetric.status !== c6Metric.status);
  }

  assert.equal(immutableDifferences, 0, `${label}: campos inmutables`);
  assert.equal(unexpectedDifferences, 0, `${label}: diferencias no autorizadas`);
  assert.equal(signalsDifferences, 0, `${label}: signals`);
  assert.equal(statusDifferences, 0, `${label}: status`);
  for (const field of C7_REMOVED_METRIC_FIELDS) {
    assert.equal(removedFields[field], actual.length, `${label}: retirada ${field}`);
  }
  return {
    immutableDifferences,
    metrics: actual.length,
    removedFields,
    signalsDifferences,
    statusDifferences,
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

export async function verifyBlock2C7Contract() {
  const historicalGolden = await readVerifiedV18GoldenV2();
  const historicalFixture = await readVerifiedV18AdversarialFixture();
  const [currentDemo, currentFixture] = await Promise.all([
    buildV18Baseline(),
    runCurrentMetricsOnV18AdversarialFixture(),
  ]);
  assert.equal(currentDemo.datasetSha256, V18_DATASET_SHA256);

  const c6Demo = buildC6ExpectedCollection(
    buildC1ExpectedCollection(
      historicalGolden.metrics,
      currentDemo.inputs.wellbeing,
    ),
  );
  const c6Fixture = buildC6ExpectedCollection(
    buildC1ExpectedCollection(
      historicalFixture.output,
      historicalFixture.input.wellbeing,
    ),
  );
  const demo = verifyCollection({
    actual: currentDemo.metrics,
    c6Expected: c6Demo,
    historical: historicalGolden.metrics,
    label: "DEMO C7",
  });
  const fixture = verifyCollection({
    actual: currentFixture.output,
    c6Expected: c6Fixture,
    historical: historicalFixture.output,
    label: "Fixture C7",
  });

  const demoSignals = currentDemo.metrics.reduce(
    (total, metric) => total + metric.signals.length,
    0,
  );
  const demoStatus = countBy(currentDemo.metrics, "status");
  assert.equal(demoSignals, 109);
  assert.deepEqual(demoStatus, {
    OK: 659,
    REVISAR: 7,
    VIGILAR: 90,
    null: 4,
  });

  const historicalPlansWithTargetRpe = currentDemo.inputs.plans.filter(
    (plan) => Object.hasOwn(plan, "targetRpe"),
  );
  assert.equal(historicalPlansWithTargetRpe.length, 152);
  const r9Plans = historicalFixture.input.plans.filter(
    (plan) => plan.weekId === 7,
  );
  assert.deepEqual(r9Plans.map((plan) => plan.plannedDuration), [60, 60, 60, 60]);
  assert.deepEqual(r9Plans.map((plan) => plan.targetRpe), [5, 5, 5, 5]);

  return {
    datasetSha256: currentDemo.datasetSha256,
    demo: {
      ...demo,
      signals: demoSignals,
      status: demoStatus,
    },
    fixture,
    historical: {
      fixtureInputSha256: historicalFixture.inputSha256,
      fixtureOutputSha256: historicalFixture.outputSha256,
      goldenSha256: historicalGolden.goldenSha256,
      plansWithTargetRpe: historicalPlansWithTargetRpe.length,
    },
  };
}

export async function characterizeBlock2C7Contract() {
  const historicalGolden = await readVerifiedV18GoldenV2();
  const historicalFixture = await readVerifiedV18AdversarialFixture();
  const currentDemo = await buildV18Baseline();
  assert.equal(currentDemo.datasetSha256, V18_DATASET_SHA256);

  const c6Demo = buildC6ExpectedCollection(
    buildC1ExpectedCollection(
      historicalGolden.metrics,
      currentDemo.inputs.wellbeing,
    ),
  );
  const c6Fixture = buildC6ExpectedCollection(
    buildC1ExpectedCollection(
      historicalFixture.output,
      historicalFixture.input.wellbeing,
    ),
  );
  const expectedDemo = buildC7ExpectedCollection(c6Demo);
  const expectedFixture = buildC7ExpectedCollection(c6Fixture);
  const demo = verifyCollection({
    actual: expectedDemo,
    c6Expected: c6Demo,
    historical: historicalGolden.metrics,
    label: "Estadio DEMO C7",
  });
  const fixture = verifyCollection({
    actual: expectedFixture,
    c6Expected: c6Fixture,
    historical: historicalFixture.output,
    label: "Estadio fixture C7",
  });
  const demoSignals = expectedDemo.reduce(
    (total, metric) => total + metric.signals.length,
    0,
  );
  const demoStatus = countBy(expectedDemo, "status");
  assert.equal(demoSignals, 109);
  assert.deepEqual(demoStatus, {
    OK: 659,
    REVISAR: 7,
    VIGILAR: 90,
    null: 4,
  });

  return {
    datasetSha256: currentDemo.datasetSha256,
    demo: { ...demo, signals: demoSignals, status: demoStatus },
    fixture,
    historical: {
      fixtureInputSha256: historicalFixture.inputSha256,
      fixtureOutputSha256: historicalFixture.outputSha256,
      goldenSha256: historicalGolden.goldenSha256,
      plansWithTargetRpe: currentDemo.inputs.plans.filter((plan) =>
        Object.hasOwn(plan, "targetRpe"),
      ).length,
    },
  };
}
