import assert from "node:assert/strict";
import { serializeCanonicalJson } from "./canonical-json.mjs";
import {
  buildC1ExpectedCollection,
  C1_IMMUTABLE_FIELDS,
  topLevelDifferences,
} from "./block2-c1-contract.mjs";
import { buildC6ExpectedCollection } from "./block2-c6-contract.mjs";
import { buildC7ExpectedCollection } from "./block2-c7-contract.mjs";
import {
  readVerifiedV18AdversarialFixture,
  runCurrentMetricsOnV18AdversarialFixture,
} from "./v18-adversarial.mjs";
import { buildV18Baseline, V18_DATASET_SHA256 } from "./v18-baseline.mjs";
import { readVerifiedV18GoldenV2 } from "./v18-golden.mjs";

export const C4_BASELINE_WINDOW = 8;
export const C4_BASELINE_MINIMUM = 5;
export const C4_RPE_MIN_MEANINGFUL_DELTA = 0.5;

export const C4_ALLOWED_FIELDS = [
  "zRpe",
  "zSleep",
  "rpeRange",
  "sleepRange",
  "signals",
  "reasons",
  "status",
];

const allowedFields = new Set(C4_ALLOWED_FIELDS);
const metricKey = (metric) => `${metric.weekId}-${metric.playerId}`;
const round = (value, decimals = 1) =>
  value == null ? null : Math.round(value * 10 ** decimals) / 10 ** decimals;
const validValues = (values) =>
  values.filter(
    (value) => typeof value === "number" && Number.isFinite(value),
  );
const mean = (values) => {
  const valid = validValues(values);
  return valid.length
    ? valid.reduce((total, value) => total + value, 0) / valid.length
    : null;
};
const populationBaseline = (values) => {
  const valid = validValues(values);
  if (valid.length < C4_BASELINE_MINIMUM) return null;
  const average = mean(valid);
  return {
    mean: average,
    sd: Math.sqrt(
      valid.reduce((total, value) => total + (value - average) ** 2, 0) /
        valid.length,
    ),
    values: valid,
  };
};
const sampleBaseline = (values) => {
  const valid = validValues(values);
  if (valid.length < C4_BASELINE_MINIMUM || valid.length < 2) return null;
  const average = mean(valid);
  return {
    mean: average,
    sd: Math.sqrt(
      valid.reduce((total, value) => total + (value - average) ** 2, 0) /
        (valid.length - 1),
    ),
    values: valid,
  };
};
const zScore = (value, baseline) =>
  typeof value !== "number" ||
  !Number.isFinite(value) ||
  !baseline ||
  baseline.sd === 0
    ? null
    : (value - baseline.mean) / baseline.sd;
const formatSignalValue = (value) =>
  value.toLocaleString("es-ES", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

const createInputReader = (input) => {
  const sessionIndex = new Map();
  for (const session of input.sessions) {
    const key = `${session.weekId}-${session.playerId}`;
    const bucket = sessionIndex.get(key);
    if (bucket) bucket.push(session);
    else sessionIndex.set(key, [session]);
  }
  const wellbeingIndex = new Map(
    input.wellbeing.map((row) => [`${row.weekId}-${row.playerId}`, row]),
  );
  const calendarIds = input.calendar.map((week) => week.id);
  const calendarIndex = new Map(calendarIds.map((id, index) => [id, index]));
  const rawRpe = (playerId, weekId) =>
    mean(
      (sessionIndex.get(`${weekId}-${playerId}`) ?? [])
        .filter((session) => session.attendance === "ENTRENÓ")
        .map((session) => session.rpe),
    );
  const sleep = (playerId, weekId) =>
    wellbeingIndex.get(`${weekId}-${playerId}`)?.sleep ?? null;
  const previousWeekIds = (weekId) => {
    const index = calendarIndex.get(weekId);
    assert.notEqual(index, undefined, `C4: jornada desconocida ${weekId}`);
    return calendarIds.slice(
      Math.max(0, index - C4_BASELINE_WINDOW),
      index,
    );
  };
  return { previousWeekIds, rawRpe, sleep };
};

const buildExpectedMetric = (c7Metric, inputReader, thresholds) => {
  const previous = inputReader.previousWeekIds(c7Metric.weekId);
  const priorRpe = previous.map((weekId) =>
    round(inputReader.rawRpe(c7Metric.playerId, weekId)),
  );
  const priorSleep = previous.map((weekId) =>
    inputReader.sleep(c7Metric.playerId, weekId),
  );
  const populationRpe = populationBaseline(priorRpe);
  const populationSleep = populationBaseline(priorSleep);
  const sampleRpe = sampleBaseline(priorRpe);
  const sampleSleep = sampleBaseline(priorSleep);

  assert.deepEqual(sampleRpe?.values ?? null, populationRpe?.values ?? null);
  assert.deepEqual(sampleSleep?.values ?? null, populationSleep?.values ?? null);
  assert.equal(sampleRpe?.mean ?? null, populationRpe?.mean ?? null);
  assert.equal(sampleSleep?.mean ?? null, populationSleep?.mean ?? null);
  assert.equal(c7Metric.personalRpe, round(populationRpe?.mean ?? null));
  assert.equal(c7Metric.personalSleep, round(populationSleep?.mean ?? null));

  const currentRpe = inputReader.rawRpe(c7Metric.playerId, c7Metric.weekId);
  const currentSleep = inputReader.sleep(c7Metric.playerId, c7Metric.weekId);
  const rawZRpe = zScore(currentRpe, sampleRpe);
  const rawZSleep = zScore(currentSleep, sampleSleep);
  const rpeDelta =
    currentRpe == null || !sampleRpe ? null : currentRpe - sampleRpe.mean;
  const shouldSignalRpe =
    rawZRpe != null &&
    rawZRpe >= thresholds.zScore &&
    rpeDelta >= C4_RPE_MIN_MEANINGFUL_DELTA;

  const expected = structuredClone(c7Metric);
  expected.zRpe = round(rawZRpe, 2);
  expected.zSleep = round(rawZSleep, 2);
  expected.rpeRange = sampleRpe
    ? [round(sampleRpe.mean - sampleRpe.sd), round(sampleRpe.mean + sampleRpe.sd)]
    : null;
  expected.sleepRange = sampleSleep
    ? [
        round(sampleSleep.mean - sampleSleep.sd),
        round(sampleSleep.mean + sampleSleep.sd),
      ]
    : null;

  const oldRpeSignal = expected.signals.find(
    (signal) => signal.key === "rpe-z",
  );
  if (oldRpeSignal && !shouldSignalRpe) {
    expected.signals = expected.signals.filter(
      (signal) => signal.key !== "rpe-z",
    );
  } else if (oldRpeSignal && shouldSignalRpe) {
    oldRpeSignal.difference = `z +${formatSignalValue(rawZRpe)}`;
    oldRpeSignal.explanation = `Se desvía ${formatSignalValue(rawZRpe)} desviaciones respecto a sus 8 semanas anteriores.`;
  } else {
    assert.equal(
      shouldSignalRpe,
      false,
      `C4: no puede aparecer una señal rpe-z nueva en ${metricKey(c7Metric)}`,
    );
  }
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

  return {
    evidence: {
      currentRpe,
      rpeDelta,
      rpeValues: sampleRpe?.values ?? validValues(priorRpe),
      sleepValues: sampleSleep?.values ?? validValues(priorSleep),
    },
    metric: expected,
  };
};

export const buildC4ExpectedCollection = (c7Metrics, input) => {
  const inputReader = createInputReader(input);
  const evidence = new Map();
  const metrics = c7Metrics.map((metric) => {
    const expected = buildExpectedMetric(metric, inputReader, input.thresholds);
    evidence.set(metricKey(metric), expected.evidence);
    return expected.metric;
  });
  return { evidence, metrics };
};

const sleepSignalKeys = (metric) =>
  metric.signals
    .filter((signal) => signal.key.startsWith("sleep-"))
    .map((signal) => signal.key);
const countSignals = (metrics, predicate) =>
  metrics.reduce(
    (total, metric) => total + metric.signals.filter(predicate).length,
    0,
  );
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
  assert.ok(metric, `Fixture C4: falta ${weekId}-${playerId}`);
  return metric;
};

const verifyCollection = ({ actual, c7Expected, c4Expected, historical, label }) => {
  assert.equal(actual.length, historical.length, `${label}: longitud`);
  const actualByKey = new Map(actual.map((metric) => [metricKey(metric), metric]));
  const c7ByKey = new Map(c7Expected.map((metric) => [metricKey(metric), metric]));
  const c4ByKey = new Map(c4Expected.map((metric) => [metricKey(metric), metric]));
  const changedFields = Object.fromEntries(
    C4_ALLOWED_FIELDS.map((field) => [field, 0]),
  );
  let immutableDifferences = 0;
  let unexpectedDifferences = 0;
  let personalRpeDifferences = 0;
  let personalSleepDifferences = 0;
  let sleepSignalDifferences = 0;

  for (const historicalMetric of historical) {
    const key = metricKey(historicalMetric);
    const actualMetric = actualByKey.get(key);
    const c7Metric = c7ByKey.get(key);
    const expectedMetric = c4ByKey.get(key);
    assert.ok(actualMetric, `${label}: falta salida C4 ${key}`);
    assert.ok(c7Metric, `${label}: falta estadio C7 ${key}`);
    assert.ok(expectedMetric, `${label}: falta contrato C4 ${key}`);
    assert.equal(
      serializeCanonicalJson(actualMetric),
      serializeCanonicalJson(expectedMetric),
      `${label}: salida C4 incorrecta en ${key}`,
    );
    for (const field of C1_IMMUTABLE_FIELDS) {
      immutableDifferences += Number(
        !Object.is(actualMetric[field], historicalMetric[field]),
      );
    }
    const stageDifferences = topLevelDifferences(c7Metric, actualMetric);
    const unauthorized = stageDifferences.filter(
      (field) => !allowedFields.has(field),
    );
    unexpectedDifferences += unauthorized.length;
    assert.deepEqual(
      unauthorized,
      [],
      `${label}: diferencias fuera de contrato en ${key}`,
    );
    for (const field of C4_ALLOWED_FIELDS) {
      changedFields[field] += Number(stageDifferences.includes(field));
    }
    personalRpeDifferences += Number(
      !Object.is(actualMetric.personalRpe, c7Metric.personalRpe),
    );
    personalSleepDifferences += Number(
      !Object.is(actualMetric.personalSleep, c7Metric.personalSleep),
    );
    sleepSignalDifferences += Number(
      serializeCanonicalJson(sleepSignalKeys(actualMetric)) !==
        serializeCanonicalJson(sleepSignalKeys(c7Metric)),
    );
  }

  assert.equal(immutableDifferences, 0, `${label}: campos inmutables`);
  assert.equal(unexpectedDifferences, 0, `${label}: diferencias no autorizadas`);
  assert.equal(personalRpeDifferences, 0, `${label}: personalRpe`);
  assert.equal(personalSleepDifferences, 0, `${label}: personalSleep`);
  assert.equal(sleepSignalDifferences, 0, `${label}: señales de sueño`);
  return {
    changedFields,
    immutableDifferences,
    metrics: actual.length,
    personalRpeDifferences,
    personalSleepDifferences,
    sleepSignalDifferences,
    unexpectedDifferences,
  };
};

export async function verifyBlock2C4Contract() {
  const historicalGolden = await readVerifiedV18GoldenV2();
  const historicalFixture = await readVerifiedV18AdversarialFixture();
  const [currentDemo, currentFixture] = await Promise.all([
    buildV18Baseline(),
    runCurrentMetricsOnV18AdversarialFixture(),
  ]);
  assert.equal(currentDemo.datasetSha256, V18_DATASET_SHA256);

  const c7Demo = buildC7ExpectedCollection(
    buildC6ExpectedCollection(
      buildC1ExpectedCollection(
        historicalGolden.metrics,
        currentDemo.inputs.wellbeing,
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
  const expectedDemo = buildC4ExpectedCollection(c7Demo, currentDemo.inputs);
  const expectedFixture = buildC4ExpectedCollection(
    c7Fixture,
    {
      ...historicalFixture.input,
      calendar: currentDemo.inputs.calendar,
    },
  );
  const demo = verifyCollection({
    actual: currentDemo.metrics,
    c7Expected: c7Demo,
    c4Expected: expectedDemo.metrics,
    historical: historicalGolden.metrics,
    label: "DEMO C4",
  });
  const fixture = verifyCollection({
    actual: currentFixture.output,
    c7Expected: c7Fixture,
    c4Expected: expectedFixture.metrics,
    historical: historicalFixture.output,
    label: "Fixture C4",
  });

  assert.equal(demo.changedFields.zRpe, 612);
  assert.equal(demo.changedFields.zSleep, 616);
  assert.equal(demo.changedFields.rpeRange, 323);
  assert.equal(demo.changedFields.sleepRange, 154);
  const rpeSignalsBefore = countSignals(
    c7Demo,
    (signal) => signal.key === "rpe-z",
  );
  const rpeSignalsAfter = countSignals(
    currentDemo.metrics,
    (signal) => signal.key === "rpe-z",
  );
  const sleepSignalsBefore = countSignals(
    c7Demo,
    (signal) => signal.key.startsWith("sleep-"),
  );
  const sleepSignalsAfter = countSignals(
    currentDemo.metrics,
    (signal) => signal.key.startsWith("sleep-"),
  );
  const signals = currentDemo.metrics.reduce(
    (total, metric) => total + metric.signals.length,
    0,
  );
  const status = countBy(currentDemo.metrics, "status");
  assert.deepEqual([rpeSignalsBefore, rpeSignalsAfter], [53, 49]);
  assert.deepEqual([sleepSignalsBefore, sleepSignalsAfter], [47, 47]);
  assert.equal(signals, 105);
  assert.deepEqual(status, {
    OK: 663,
    REVISAR: 7,
    VIGILAR: 86,
    null: 4,
  });

  const r6 = metricAt(currentFixture.output, "ADV-STABLE", 6);
  const r9 = metricAt(currentFixture.output, "ADV-EDGE", 7);
  const r10 = metricAt(currentFixture.output, "ADV-EDGE", 8);
  assert.deepEqual(
    {
      reasons: r6.reasons,
      signalKeys: r6.signals.map((signal) => signal.key),
      status: r6.status,
      zRpe: r6.zRpe,
    },
    { reasons: [], signalKeys: [], status: "OK", zRpe: 2.31 },
  );
  assert.deepEqual(
    {
      signalKeys: r9.signals.map((signal) => signal.key),
      status: r9.status,
      zRpe: r9.zRpe,
    },
    { signalKeys: [], status: "OK", zRpe: 1.1 },
  );
  assert.deepEqual(
    {
      pending: r10.pending,
      reasons: r10.reasons,
      recordCompleteness: r10.recordCompleteness,
      signalKeys: r10.signals.map((signal) => signal.key),
      status: r10.status,
      zRpe: r10.zRpe,
    },
    {
      pending: 1,
      reasons: [],
      recordCompleteness: "PARTIAL",
      signalKeys: [],
      status: "OK",
      zRpe: 2.13,
    },
  );
  assert.equal(round(expectedFixture.evidence.get("6-ADV-STABLE").rpeDelta, 2), 0.38);
  assert.equal(round(expectedFixture.evidence.get("8-ADV-EDGE").rpeDelta, 2), 0.35);

  return {
    causality: {
      baselineMinimum: C4_BASELINE_MINIMUM,
      baselineWindow: C4_BASELINE_WINDOW,
      meanDifferences: 0,
      observationSetDifferences: 0,
      rpeMinimumDelta: C4_RPE_MIN_MEANINGFUL_DELTA,
      sdDenominatorBefore: "N",
      sdDenominatorAfter: "n-1",
    },
    datasetSha256: currentDemo.datasetSha256,
    demo: {
      ...demo,
      rpeSignals: { after: rpeSignalsAfter, before: rpeSignalsBefore },
      signals,
      sleepSignals: { after: sleepSignalsAfter, before: sleepSignalsBefore },
      status,
    },
    fixture: {
      ...fixture,
      rows: { R6: r6, R9: r9, R10: r10 },
    },
    historical: {
      fixtureInputSha256: historicalFixture.inputSha256,
      fixtureOutputSha256: historicalFixture.outputSha256,
      goldenSha256: historicalGolden.goldenSha256,
    },
  };
}
