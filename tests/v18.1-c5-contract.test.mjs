import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { verifyBlock2C5Contract } from "../scripts/block2-c5-contract.mjs";
import { withCurrentMetricsEngine } from "../scripts/metrics-characterization.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const withoutBlockComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "");

test("C5 coincide exactamente con la matriz aprobada", async () => {
  const result = await verifyBlock2C5Contract();
  assert.equal(result.demo.metrics, 760);
  assert.equal(result.fixture.metrics, 10);
  assert.deepEqual(result.demo.before, {
    monotonyNonNull: 756,
    strainNonNull: 756,
  });
  assert.deepEqual(result.demo.after, { monotonyNull: 760, strainNull: 760 });
  assert.deepEqual(result.demo.changedFields, { monotony: 756, strain: 756 });
  assert.deepEqual(result.fixture.changedFields, { monotony: 9, strain: 9 });
  assert.equal(result.demo.signals, 105);
  assert.deepEqual(result.demo.status, {
    OK: 663,
    REVISAR: 7,
    VIGILAR: 86,
    null: 4,
  });
  assert.equal(result.demo.immutableDifferences, 0);
  assert.equal(result.fixture.immutableDifferences, 0);
  assert.equal(result.demo.unexpectedDifferences, 0);
  assert.equal(result.fixture.unexpectedDifferences, 0);
  assert.equal(result.demo.signalsDifferences, 0);
  assert.equal(result.demo.reasonsDifferences, 0);
  assert.equal(result.demo.statusDifferences, 0);
});

test("C5 conserva los campos compatibles como null y retira el cálculo público", async () => {
  const domain = await withCurrentMetricsEngine(({ domain }) => domain);
  assert.equal("monotonyAndStrain" in domain, false);
  assert.equal("standardDeviation" in domain, false);

  const result = await verifyBlock2C5Contract();
  assert.ok(
    result.fixture.rows.every(
      (row) => row.monotony.after === null && row.strain.after === null,
    ),
  );
});

test("C5 elimina el vector falso, consumidores, umbral y microcopy activa", async () => {
  const [orchestrator, primitives, pageSource, css, types] = await Promise.all([
    read("../domain/metrics/build-metrics.ts"),
    read("../domain/metrics/primitives.ts"),
    read("../app/page.tsx"),
    read("../app/globals.css"),
    read("../domain/metrics/types.ts"),
  ]);
  const page = withoutBlockComments(pageSource);

  assert.match(orchestrator, /monotony:\s*null/);
  assert.match(orchestrator, /strain:\s*null/);
  assert.doesNotMatch(orchestrator, /sessionLoads|\bdaily\b|monotonyAndStrain/);
  assert.doesNotMatch(primitives, /monotonyAndStrain|standardDeviation/);
  assert.match(types, /monotony:\s*number \| null/);
  assert.match(types, /strain:\s*number \| null/);
  assert.doesNotMatch(types, /highMonotony/);
  assert.doesNotMatch(page, /\.monotony\b|\.strain\b|highMonotony/);
  assert.doesNotMatch(page, /Monoton[ií]a|\bstrain\b/i);
  assert.doesNotMatch(
    css,
    /load-advanced|player-advanced-v7|inline-advanced|advanced-inline/,
  );
});

test("C5 elimina el bloque avanzado residual y reubica Z-RPE sin duplicarlo", async () => {
  const page = withoutBlockComments(await read("../app/page.tsx"));
  assert.doesNotMatch(page, /Análisis avanzado/);
  assert.equal((page.match(/Z-RPE personal/g) ?? []).length, 1);
});
