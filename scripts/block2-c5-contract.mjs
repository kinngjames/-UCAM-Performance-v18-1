import assert from "node:assert/strict";
import { serializeCanonicalJson } from "./canonical-json.mjs";
import {
  buildC1ExpectedCollection,
  C1_IMMUTABLE_FIELDS,
  topLevelDifferences,
} from "./block2-c1-contract.mjs";
import { buildC4ExpectedCollection } from "./block2-c4-contract.mjs";
import { buildC6ExpectedCollection } from "./block2-c6-contract.mjs";
import { buildC7ExpectedCollection } from "./block2-c7-contract.mjs";
import {
  readVerifiedV18AdversarialFixture,
  runCurrentMetricsOnV18AdversarialFixture,
} from "./v18-adversarial.mjs";
import { buildV18Baseline, V18_DATASET_SHA256 } from "./v18-baseline.mjs";
import { readVerifiedV18GoldenV2 } from "./v18-golden.mjs";

export const C5_ALLOWED_FIELDS = ["monotony", "strain"];

const allowedFields = new Set(C5_ALLOWED_FIELDS);
const metricKey = (metric) => `${metric.weekId}-${metric.playerId}`;
const countBy = (metrics, field) =>
  Object.fromEntries(
    metrics.reduce((counts, metric) => {
      const value = metric[field] === null ? "null" : metric[field];
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map()),
  );

export const buildC5ExpectedMetric = (c4Metric) => ({
  ...structuredClone(c4Metric),
  monotony: null,
  strain: null,
});

export const buildC5ExpectedCollection = (c4Metrics) =>
  c4Metrics.map(buildC5ExpectedMetric);

const verifyCollection = ({ actual, c4Expected, historical, label }) => {
  assert.equal(actual.length, historical.length, `${label}: longitud`);
  const actualByKey = new Map(actual.map((metric) => [metricKey(metric), metric]));
  const c4ByKey = new Map(c4Expected.map((metric) => [metricKey(metric), metric]));
  let immutableDifferences = 0;
  let unexpectedDifferences = 0;
  let signalsDifferences = 0;
  let reasonsDifferences = 0;
  let statusDifferences = 0;
  const changedFields = { monotony: 0, strain: 0 };
  const before = { monotonyNonNull: 0, strainNonNull: 0 };
  const after = { monotonyNull: 0, strainNull: 0 };

  for (const historicalMetric of historical) {
    const key = metricKey(historicalMetric);
    const c4Metric = c4ByKey.get(key);
    const actualMetric = actualByKey.get(key);
    assert.ok(c4Metric, `${label}: falta estadio C4 ${key}`);
    assert.ok(actualMetric, `${label}: falta salida C5 ${key}`);
    const expectedMetric = buildC5ExpectedMetric(c4Metric);
    assert.equal(
      serializeCanonicalJson(actualMetric),
      serializeCanonicalJson(expectedMetric),
      `${label}: salida C5 incorrecta en ${key}`,
    );

    for (const field of C1_IMMUTABLE_FIELDS) {
      immutableDifferences += Number(
        !Object.is(actualMetric[field], historicalMetric[field]),
      );
    }
    const stageDifferences = topLevelDifferences(c4Metric, actualMetric);
    const unauthorized = stageDifferences.filter(
      (field) => !allowedFields.has(field),
    );
    unexpectedDifferences += unauthorized.length;
    assert.deepEqual(
      unauthorized,
      [],
      `${label}: diferencias fuera de contrato en ${key}`,
    );
    for (const field of C5_ALLOWED_FIELDS) {
      changedFields[field] += Number(stageDifferences.includes(field));
    }
    before.monotonyNonNull += Number(c4Metric.monotony != null);
    before.strainNonNull += Number(c4Metric.strain != null);
    after.monotonyNull += Number(actualMetric.monotony == null);
    after.strainNull += Number(actualMetric.strain == null);
    signalsDifferences += Number(
      serializeCanonicalJson(actualMetric.signals) !==
        serializeCanonicalJson(c4Metric.signals),
    );
    reasonsDifferences += Number(
      serializeCanonicalJson(actualMetric.reasons) !==
        serializeCanonicalJson(c4Metric.reasons),
    );
    statusDifferences += Number(actualMetric.status !== c4Metric.status);
  }

  assert.equal(immutableDifferences, 0, `${label}: campos inmutables`);
  assert.equal(unexpectedDifferences, 0, `${label}: diferencias no autorizadas`);
  assert.equal(signalsDifferences, 0, `${label}: signals`);
  assert.equal(reasonsDifferences, 0, `${label}: reasons`);
  assert.equal(statusDifferences, 0, `${label}: status`);
  assert.equal(after.monotonyNull, actual.length, `${label}: monotony final`);
  assert.equal(after.strainNull, actual.length, `${label}: strain final`);

  return {
    after,
    before,
    changedFields,
    immutableDifferences,
    metrics: actual.length,
    reasonsDifferences,
    signalsDifferences,
    statusDifferences,
    unexpectedDifferences,
  };
};

const buildC4Stages = ({ historicalGolden, historicalFixture, demoInputs }) => {
  const c7Demo = buildC7ExpectedCollection(
    buildC6ExpectedCollection(
      buildC1ExpectedCollection(
        historicalGolden.metrics,
        demoInputs.wellbeing,
      ),
    ),
  );
  const c7Fixture = buildC7ExpectedCollection(
    buildC6ExpectedCollection(
      buildC1ExpectedCollection(
        historicalFixture.output,
        historicalFixture.input.wellbeing,
      ),
    ),
  );
  return {
    demo: buildC4ExpectedCollection(c7Demo, demoInputs).metrics,
    fixture: buildC4ExpectedCollection(c7Fixture, {
      ...historicalFixture.input,
      calendar: demoInputs.calendar,
    }).metrics,
  };
};

export async function verifyBlock2C5Contract() {
  const historicalGolden = await readVerifiedV18GoldenV2();
  const historicalFixture = await readVerifiedV18AdversarialFixture();
  const [currentDemo, currentFixture] = await Promise.all([
    buildV18Baseline(),
    runCurrentMetricsOnV18AdversarialFixture(),
  ]);
  assert.equal(currentDemo.datasetSha256, V18_DATASET_SHA256);

  const c4 = buildC4Stages({
    historicalFixture,
    historicalGolden,
    demoInputs: currentDemo.inputs,
  });
  const demo = verifyCollection({
    actual: currentDemo.metrics,
    c4Expected: c4.demo,
    historical: historicalGolden.metrics,
    label: "DEMO C5",
  });
  const fixture = verifyCollection({
    actual: currentFixture.output,
    c4Expected: c4.fixture,
    historical: historicalFixture.output,
    label: "Fixture C5",
  });

  assert.deepEqual(demo.before, {
    monotonyNonNull: 756,
    strainNonNull: 756,
  });
  assert.deepEqual(demo.after, { monotonyNull: 760, strainNull: 760 });
  assert.deepEqual(demo.changedFields, { monotony: 756, strain: 756 });
  assert.deepEqual(fixture.changedFields, { monotony: 9, strain: 9 });

  const fixtureRows = currentFixture.output.map((metric, index) => ({
    id: `R${index + 1}`,
    monotony: {
      after: metric.monotony,
      before: c4.fixture[index].monotony,
    },
    playerId: metric.playerId,
    strain: { after: metric.strain, before: c4.fixture[index].strain },
    weekId: metric.weekId,
  }));
  assert.deepEqual(
    fixtureRows.map((row) => row.monotony.before),
    [0.41, 0.41, 0.41, 0.41, 0.41, 1.4, 0.41, null, 0.63, 0.41],
  );
  assert.deepEqual(
    fixtureRows.map((row) => row.strain.before),
    [147, 154, 147, 154, 147, 2394, 400, null, 478, 159],
  );
  assert.ok(
    fixtureRows.every(
      (row) => row.monotony.after === null && row.strain.after === null,
    ),
  );

  const signals = currentDemo.metrics.reduce(
    (total, metric) => total + metric.signals.length,
    0,
  );
  const status = countBy(currentDemo.metrics, "status");
  assert.equal(signals, 105);
  assert.deepEqual(status, {
    OK: 663,
    REVISAR: 7,
    VIGILAR: 86,
    null: 4,
  });

  return {
    datasetSha256: currentDemo.datasetSha256,
    demo: { ...demo, signals, status },
    fixture: { ...fixture, rows: fixtureRows },
    historical: {
      fixtureInputSha256: historicalFixture.inputSha256,
      fixtureOutputSha256: historicalFixture.outputSha256,
      goldenSha256: historicalGolden.goldenSha256,
    },
  };
}
