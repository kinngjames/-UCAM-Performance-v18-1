import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { serializeCanonicalJson, sha256Utf8 } from "../scripts/canonical-json.mjs";
import {
  generateV18AdversarialFixture,
  readV18AdversarialInput,
  readV18AdversarialOutput,
  V18_ADVERSARIAL_INPUT_SHA256,
  V18_ADVERSARIAL_OUTPUT_SHA256,
} from "../scripts/v18-adversarial.mjs";
import { V18_DATASET_SHA256 } from "../scripts/v18-baseline.mjs";
import {
  V18_GOLDEN_V2_PATH,
  V18_GOLDEN_V2_SHA256,
} from "../scripts/v18-golden.mjs";

const metricAt = (output, playerId, weekId) => {
  const metric = output.find(
    (item) => item.playerId === playerId && item.weekId === weekId,
  );
  assert.ok(metric, `Falta ${weekId}-${playerId}`);
  return metric;
};

test("fixture y oráculo adversarial son canónicos, inmutables y deterministas", async () => {
  const [runA, runB, storedInput, storedOutput, golden] = await Promise.all([
    generateV18AdversarialFixture(),
    generateV18AdversarialFixture(),
    readV18AdversarialInput(),
    readV18AdversarialOutput(),
    readFile(V18_GOLDEN_V2_PATH, "utf8"),
  ]);

  assert.equal(runA.input.baseDatasetSha256, V18_DATASET_SHA256);
  assert.equal(runA.inputContents, storedInput);
  assert.equal(runA.outputContents, storedOutput);
  assert.equal(runA.inputSha256, V18_ADVERSARIAL_INPUT_SHA256);
  assert.equal(runB.inputSha256, V18_ADVERSARIAL_INPUT_SHA256);
  assert.equal(runA.outputSha256, V18_ADVERSARIAL_OUTPUT_SHA256);
  assert.equal(runB.outputSha256, V18_ADVERSARIAL_OUTPUT_SHA256);
  assert.equal(runA.outputContents, runB.outputContents);
  assert.equal(runA.output.length, 10);
  assert.equal(sha256Utf8(golden), V18_GOLDEN_V2_SHA256);
  assert.equal(storedInput, serializeCanonicalJson(JSON.parse(storedInput)));
  assert.equal(storedOutput, serializeCanonicalJson(JSON.parse(storedOutput)));
});

test("el oráculo detecta por separado una corrección de cada caso", async () => {
  const { output, outputSha256 } = await generateV18AdversarialFixture();
  const mutate = (change) => {
    const copy = structuredClone(output);
    change(copy);
    return sha256Utf8(serializeCanonicalJson(copy));
  };
  const correctedHashes = [
    mutate((copy) => {
      delete metricAt(copy, "ADV-EDGE", 6).compliance;
    }),
    mutate((copy) => {
      const metric = metricAt(copy, "ADV-EDGE", 7);
      metric.plannedTrainingLoad = 1200;
      metric.plannedTotalLoad = 1200;
    }),
    mutate((copy) => {
      metricAt(copy, "ADV-EDGE", 5).ratio = null;
    }),
    mutate((copy) => {
      const metric = metricAt(copy, "ADV-STABLE", 6);
      metric.signals = metric.signals.filter((signal) => signal.key !== "rpe-z");
    }),
    mutate((copy) => {
      const metric = metricAt(copy, "ADV-STABLE", 6);
      delete metric.monotony;
      delete metric.strain;
    }),
    mutate((copy) => {
      metricAt(copy, "ADV-EDGE", 8).status = "VIGILAR";
    }),
  ];

  assert.equal(new Set([outputSha256, ...correctedHashes]).size, 7);
});

test("C1 caracteriza lesionado sin bienestar como 0% e incompleto", async () => {
  const { output } = await generateV18AdversarialFixture();
  const metric = metricAt(output, "ADV-EDGE", 6);

  assert.equal(metric.availability, "NO DISPONIBLE");
  assert.equal(metric.rpeExpected, 0);
  assert.equal(metric.wellbeingDone, false);
  assert.equal(metric.compliance, 0);
  assert.equal(metric.pending, 1);
  assert.equal(metric.status, "INCOMPLETO");
  assert.deepEqual(metric.signals.map((signal) => signal.key), ["pending"]);
});

test("C2 caracteriza plan de cuatro sesiones reducido a las dos asistidas", async () => {
  const { input, output } = await generateV18AdversarialFixture();
  const metric = metricAt(output, "ADV-EDGE", 7);
  const plannedInputs = input.plans.map(
    ({ session, plannedDuration, targetRpe }) => ({
      session,
      plannedDuration,
      targetRpe,
    }),
  );
  const actualInputs = input.sessions
    .filter(
      (item) =>
        item.weekId === 7 &&
        item.playerId === "ADV-EDGE" &&
        item.attendance === "ENTRENÓ",
    )
    .map(({ session, minutes, rpe }) => ({ session, minutes, rpe }));
  const fullPlan = input.plans.reduce(
    (total, item) => total + item.plannedDuration * item.targetRpe,
    0,
  );

  assert.deepEqual(plannedInputs, [
    { session: 1, plannedDuration: 60, targetRpe: 5 },
    { session: 2, plannedDuration: 60, targetRpe: 5 },
    { session: 3, plannedDuration: 60, targetRpe: 5 },
    { session: 4, plannedDuration: 60, targetRpe: 5 },
  ]);
  assert.deepEqual(actualInputs, [
    { session: 1, minutes: 60, rpe: 6.3 },
    { session: 2, minutes: 60, rpe: 6.3 },
  ]);
  assert.equal(fullPlan, 1200);
  assert.equal(metric.trained, 2);
  assert.equal(metric.trainingLoad, 756);
  assert.equal(metric.plannedTrainingLoad, 600);
  assert.equal(metric.plannedTotalLoad, 600);
});

test("C3 caracteriza ratio calculado sobre una semana parcial", async () => {
  const { output } = await generateV18AdversarialFixture();
  const metric = metricAt(output, "ADV-EDGE", 5);

  assert.equal(metric.loadCompleteness, "PARTIAL");
  assert.equal(metric.completedLoadEfforts, 1);
  assert.equal(metric.expectedLoadEfforts, 2);
  assert.equal(metric.load, 980);
  assert.equal(metric.chronic, 1000);
  assert.equal(metric.ratio, 0.98);
});

test("C4 caracteriza una señal RPE amplificada por SD menor de 0,2", async () => {
  const { input, output } = await generateV18AdversarialFixture();
  const history = input.sessions
    .filter(
      (item) => item.playerId === "ADV-STABLE" && item.weekId < 6,
    )
    .map((item) => item.rpe);
  const average = history.reduce((total, value) => total + value, 0) / history.length;
  const populationSd = Math.sqrt(
    history.reduce((total, value) => total + (value - average) ** 2, 0) /
      history.length,
  );
  const metric = metricAt(output, "ADV-STABLE", 6);

  assert.deepEqual(history, [6, 6.3, 6, 6.3, 6]);
  assert.equal(average, 6.12);
  assert.ok(populationSd < 0.2);
  assert.equal(metric.avgRpe, 6.5);
  assert.equal(metric.zRpe, 2.59);
  assert.deepEqual(metric.signals.map((signal) => signal.key), ["rpe-z"]);
});

test("C5 caracteriza S4 y compensatoria como ranuras de falsa distribución diaria", async () => {
  const { input, output } = await generateV18AdversarialFixture();
  const previous = metricAt(output, "ADV-STABLE", 5);
  const metric = metricAt(output, "ADV-STABLE", 6);
  const dailyVector = [1, 2, 3, 4].map((sessionNumber) =>
    input.sessions
      .filter(
        (item) =>
          item.playerId === "ADV-STABLE" &&
          item.weekId === 6 &&
          item.session === sessionNumber,
      )
      .reduce((total, item) => total + Math.round(item.rpe * item.minutes), 0),
  );
  dailyVector.push(0, metric.compensatoryLoad, 0);

  assert.deepEqual(dailyVector, [390, 390, 390, 390, 0, 150, 0]);
  assert.equal(previous.monotony, 0.41);
  assert.equal(previous.strain, 147);
  assert.equal(metric.trained, 4);
  assert.equal(metric.trainingLoad, 1560);
  assert.equal(metric.compensatoryLoad, 150);
  assert.equal(metric.load, 1710);
  assert.equal(metric.monotony, 1.4);
  assert.equal(metric.strain, 2394);
  assert.ok(metric.monotony > previous.monotony);
  assert.ok(metric.strain > previous.strain);
});

test("C6 caracteriza VIGILAR oculto por bienestar pendiente", async () => {
  const { output } = await generateV18AdversarialFixture();
  const metric = metricAt(output, "ADV-EDGE", 8);

  assert.equal(metric.zRpe, 2.33);
  assert.equal(metric.wellbeingDone, false);
  assert.equal(metric.pending, 1);
  assert.equal(metric.compliance, 50);
  assert.deepEqual(metric.signals.map((signal) => signal.key), [
    "rpe-z",
    "pending",
  ]);
  assert.equal(metric.signals[0].severity, "watch");
  assert.equal(metric.status, "INCOMPLETO");
  assert.deepEqual(metric.reasons, [
    "RPE por encima de su comportamiento habitual",
    "Registro incompleto",
  ]);
});
