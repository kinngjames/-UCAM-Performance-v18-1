import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { characterizeBlock2C7Contract } from "../scripts/block2-c7-contract.mjs";
import { withCurrentMetricsEngine } from "../scripts/metrics-characterization.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const runtimeSource = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "");

test("el estadio contractual C7 permanece caracterizado tras avanzar a C4", async () => {
  const result = await characterizeBlock2C7Contract();
  assert.equal(result.demo.metrics, 760);
  assert.equal(result.fixture.metrics, 10);
  assert.equal(result.demo.immutableDifferences, 0);
  assert.equal(result.fixture.immutableDifferences, 0);
  assert.equal(result.demo.unexpectedDifferences, 0);
  assert.equal(result.fixture.unexpectedDifferences, 0);
  assert.equal(result.demo.signalsDifferences, 0);
  assert.equal(result.demo.statusDifferences, 0);
  assert.equal(result.demo.signals, 109);
  assert.deepEqual(result.demo.status, {
    OK: 659,
    REVISAR: 7,
    VIGILAR: 90,
    null: 4,
  });
  assert.deepEqual(result.demo.removedFields, {
    chronic: 760,
    ewma: 760,
    plannedTotalLoad: 760,
    plannedTrainingLoad: 760,
    ratio: 760,
  });
  assert.equal(result.historical.plansWithTargetRpe, 152);
});

test("plannedDuration sigue siendo el default del registro en lote sin targetRpe", async () => {
  const { applyPlannedDurationBatchDefaults, toActiveSessionPlan } =
    await withCurrentMetricsEngine(({ sessionPlan }) => sessionPlan);
  const plan = {
    closed: false,
    date: "2026-11-24",
    key: "18-2",
    md: "MD-4",
    name: "Campo",
    notes: "",
    plannedDuration: 72,
    session: 2,
    time: "18:30",
    type: "Campo",
    weekId: 18,
  };
  assert.equal(Object.hasOwn(plan, "targetRpe"), false);
  const legacy = { ...plan, targetRpe: 5 };
  assert.deepEqual(toActiveSessionPlan(legacy), plan);
  assert.equal(Object.hasOwn(toActiveSessionPlan(legacy), "targetRpe"), false);

  const records = [
    {
      attendance: "ENTRENÓ",
      incident: "",
      key: "18-2-P01",
      minutes: null,
      note: "",
      playerId: "P01",
      rpe: null,
      session: 2,
      weekId: 18,
    },
    {
      attendance: "AUSENTE",
      incident: "",
      key: "18-2-P02",
      minutes: null,
      note: "",
      playerId: "P02",
      rpe: null,
      session: 2,
      weekId: 18,
    },
  ];
  const trained = applyPlannedDurationBatchDefaults(records, plan);
  assert.equal(trained[0].minutes, 72);
  assert.equal(trained[1].minutes, null);
  const all = applyPlannedDurationBatchDefaults(records, plan, true);
  assert.deepEqual(
    all.map(({ attendance, minutes }) => ({ attendance, minutes })),
    [
      { attendance: "ENTRENÓ", minutes: 72 },
      { attendance: "ENTRENÓ", minutes: 72 },
    ],
  );
});

test("el contrato activo no expone ni persiste la analítica retirada", async () => {
  const [page, types, orchestrator, primitives, dataApi, stateApi, platform, schema] =
    await Promise.all([
      read("../app/page.tsx").then(runtimeSource),
      read("../domain/metrics/types.ts"),
      read("../domain/metrics/build-metrics.ts"),
      read("../domain/metrics/primitives.ts"),
      read("../app/api/data/route.ts"),
      read("../app/api/state/route.ts"),
      read("../lib/server/platform.ts"),
      read("../db/schema.ts"),
    ]);
  const retired =
    /\btargetRpe\b|plannedTrainingLoad|plannedTotalLoad|plannedMatchLoad|\bplanState\b|\bchronic\b|\bewma\b|\bratio\b/;
  assert.doesNotMatch(page, retired);
  assert.doesNotMatch(types, retired);
  assert.doesNotMatch(orchestrator, retired);
  assert.doesNotMatch(primitives, /\bnextEwma\b/);
  assert.doesNotMatch(dataApi, /planned_rpe|planned_load/);
  assert.doesNotMatch(stateApi, /planned_rpe|planned_load|\btargetRpe\b|\bplannedLoad\b/);
  assert.doesNotMatch(platform, /planned_rpe|planned_load|\.targetRpe\b/);
  assert.match(dataApi, /planned_duration/);
  assert.match(stateApi, /planned_duration/);
  assert.match(platform, /planned_duration/);
  assert.match(schema, /plannedRpe: real\("planned_rpe"\)/);
  assert.match(schema, /plannedLoad: real\("planned_load"\)/);
  assert.match(page, /applyPlannedDurationBatchDefaults/);
  assert.match(page, /seedSessionPlans\(\)\.map\(toActiveSessionPlan\)/);
  assert.doesNotMatch(
    page,
    /vs\.?\s*plan|carga planificada|carga prevista|objetivo RPE|RPE objetivo|\bEWMA\b|\bACWR\b|media crónica|\bcrónico\b|\bratio\b/i,
  );
});
