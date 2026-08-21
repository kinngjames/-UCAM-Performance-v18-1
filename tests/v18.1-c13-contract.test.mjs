import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { serializeCanonicalJson, sha256Utf8 } from "../scripts/canonical-json.mjs";
import { buildV18Baseline } from "../scripts/v18-baseline.mjs";
import { verifyV181AdversarialV3 } from "../scripts/v18.1-adversarial-v3.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("C13 conserva el DEMO y fija componentes desconocidos como null", async () => {
  const [baseline, golden] = await Promise.all([
    buildV18Baseline(),
    read("./fixtures/v18.1-final-player-metrics.json"),
  ]);
  const expected = JSON.parse(golden).map((metric) => {
    const withoutAlias = structuredClone(metric);
    delete withoutAlias.sessions;
    return withoutAlias;
  });
  assert.equal(
    serializeCanonicalJson(baseline.metrics),
    serializeCanonicalJson(expected),
    "tras C12, C13 solo admite además la retirada estructural de sessions",
  );
  assert.equal(
    sha256Utf8(golden),
    "08d8c2a0d681f44b71cf0264e49891eb44ce455c792306370382c0ab5fb62c9e",
  );
  assert.equal(
    baseline.metrics.reduce((sum, metric) => sum + metric.signals.length, 0),
    105,
  );
});

test("C13 coincide exactamente con la matriz M1–M4", async () => {
  const result = await verifyV181AdversarialV3();
  const byCase = new Map(result.output.map((item) => [item.caseId, item.metric]));
  const actual = Object.fromEntries(
    ["M1", "M2", "M3", "M4"].map((id) => {
      const metric = byCase.get(id);
      assert.ok(metric, `falta ${id}`);
      return [
        id,
        {
          compensatoryLoad: metric.compensatoryLoad,
          completedLoadEfforts: metric.completedLoadEfforts,
          expectedLoadEfforts: metric.expectedLoadEfforts,
          load: metric.load,
          loadCompleteness: metric.loadCompleteness,
          matchLoad: metric.matchLoad,
          trainingLoad: metric.trainingLoad,
        },
      ];
    }),
  );
  assert.deepEqual(actual, {
    M1: {
      compensatoryLoad: 0,
      completedLoadEfforts: 1,
      expectedLoadEfforts: 2,
      load: 300,
      loadCompleteness: "PARTIAL",
      matchLoad: null,
      trainingLoad: 300,
    },
    M2: {
      compensatoryLoad: 0,
      completedLoadEfforts: 1,
      expectedLoadEfforts: 2,
      load: 300,
      loadCompleteness: "PARTIAL",
      matchLoad: null,
      trainingLoad: 300,
    },
    M3: {
      compensatoryLoad: null,
      completedLoadEfforts: 1,
      expectedLoadEfforts: 2,
      load: 300,
      loadCompleteness: "PARTIAL",
      matchLoad: 0,
      trainingLoad: 300,
    },
    M4: {
      compensatoryLoad: null,
      completedLoadEfforts: 1,
      expectedLoadEfforts: 2,
      load: 300,
      loadCompleteness: "PARTIAL",
      matchLoad: 0,
      trainingLoad: 300,
    },
  });
});

test("C13 tiene una sola composición del total conocido", async () => {
  const [orchestrator, types, page] = await Promise.all([
    read("../domain/metrics/build-metrics.ts"),
    read("../domain/metrics/types.ts"),
    read("../app/page.tsx"),
  ]);
  assert.match(types, /matchLoad: number \| null/);
  assert.match(types, /compensatoryLoad: number \| null/);
  assert.match(types, /load: number/);
  assert.equal((orchestrator.match(/matchLoad \?\? 0/g) ?? []).length, 1);
  assert.equal(
    (orchestrator.match(/compensatoryLoad \?\? 0/g) ?? []).length,
    1,
  );
  assert.doesNotMatch(page, /\.matchLoad\s*\?\?\s*0/);
  assert.doesNotMatch(page, /\.compensatoryLoad\s*\?\?\s*0/);
  assert.match(page, /metric is CompleteLoadMetric/);
  assert.match(page, /Suma conocida; faltan componentes del esfuerzo/);
  assert.match(page, /loadComplete \? "" : " · parcial"/);
});
