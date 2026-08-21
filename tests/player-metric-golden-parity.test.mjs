import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertPlayerMetricGoldenParity,
  declaredPlayerMetricFields,
  PLAYER_METRIC_TYPE_PATH,
  verifyPlayerMetricGoldenParity,
} from "../scripts/player-metric-golden-parity.mjs";
import { V181_F2_GOLDEN_PATH } from "../scripts/v18.1-f2-golden.mjs";

const contract = async () => {
  const [source, contents] = await Promise.all([
    readFile(PLAYER_METRIC_TYPE_PATH, "utf8"),
    readFile(V181_F2_GOLDEN_PATH, "utf8"),
  ]);
  return {
    fields: declaredPlayerMetricFields(source),
    metrics: JSON.parse(contents),
  };
};

test("PlayerMetric y las 760 filas del golden tienen exactamente las mismas claves", async () => {
  assert.deepEqual(await verifyPlayerMetricGoldenParity(), {
    fields: [
      "availability",
      "availabilityKnown",
      "avgRpe",
      "compensatoryLoad",
      "completed",
      "completedLoadEfforts",
      "convocation",
      "expectedLoadEfforts",
      "fatigue",
      "load",
      "loadCompleteness",
      "matchLoad",
      "matchMinutes",
      "matchRpe",
      "minutes",
      "mood",
      "pain",
      "pending",
      "personalRpe",
      "personalSleep",
      "playerId",
      "reasons",
      "recordCompleteness",
      "rpeCompleted",
      "rpeExpected",
      "rpeRange",
      "signals",
      "sleep",
      "sleepRange",
      "status",
      "stress",
      "trained",
      "trainingLoad",
      "trainingMinutes",
      "weekId",
      "wellbeingDone",
      "wellbeingExpected",
      "zRpe",
      "zSleep",
    ],
    metrics: 760,
  });
});

test("la paridad detecta un campo extra añadido por cast", async () => {
  const { fields, metrics } = await contract();
  const mutant = structuredClone(metrics);
  mutant[0].extraByCast = mutant[0].completed;
  assert.throws(() => assertPlayerMetricGoldenParity(fields, mutant));
});

test("la paridad detecta una clave requerida ausente", async () => {
  const { fields, metrics } = await contract();
  const mutant = structuredClone(metrics);
  delete mutant[0].status;
  assert.throws(() => assertPlayerMetricGoldenParity(fields, mutant));
});

test("la paridad detecta la reintroducción de sessions", async () => {
  const { fields, metrics } = await contract();
  const mutant = structuredClone(metrics);
  mutant[0].sessions = mutant[0].completed;
  assert.throws(() => assertPlayerMetricGoldenParity(fields, mutant));
});
