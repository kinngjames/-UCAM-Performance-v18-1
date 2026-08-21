import assert from "node:assert/strict";
import test from "node:test";
import { withCurrentMetricsEngine } from "../scripts/metrics-characterization.mjs";

const domainPromise = withCurrentMetricsEngine(({ domain }) => domain);

test("C10 rechaza umbrales inválidos antes de escritura", async () => {
  const { validateThresholdRecordForWrite } = await domainPromise;
  assert.deepEqual(validateThresholdRecordForWrite({ relevantPain: 5 }), {
    relevantPain: 5,
  });
  for (const invalid of ["", "no-numérico", Number.NaN, -1, 11]) {
    assert.throws(
      () => validateThresholdRecordForWrite({ relevantPain: invalid }),
      /THRESHOLD_INVALID_VALUE/,
    );
  }
  assert.throws(
    () => validateThresholdRecordForWrite({ baselineWeeks: 8.5 }),
    /THRESHOLD_INVALID_VALUE/,
  );
  assert.throws(
    () => validateThresholdRecordForWrite({ unknownThreshold: 4 }),
    /THRESHOLD_UNKNOWN_KEY/,
  );
});

test("C10 normaliza lectura persistida inválida sin alterar la fuente", async () => {
  const {
    DEFAULT_ACTIVE_THRESHOLDS,
    normalizePersistedThresholdRows,
  } = await domainPromise;
  const persisted = [
    { key: "relevantPain", value: "" },
    { key: "highFatigue", value: -2 },
    { key: "lowSleep", value: 7.5 },
  ];
  const before = structuredClone(persisted);
  const normalized = normalizePersistedThresholdRows(persisted);
  assert.equal(
    normalized.thresholds.relevantPain,
    DEFAULT_ACTIVE_THRESHOLDS.relevantPain,
  );
  assert.equal(
    normalized.thresholds.highFatigue,
    DEFAULT_ACTIVE_THRESHOLDS.highFatigue,
  );
  assert.equal(normalized.thresholds.lowSleep, 7.5);
  assert.deepEqual(
    normalized.normalizations.map(({ key, reason }) => ({ key, reason })),
    [
      { key: "highFatigue", reason: "OUT_OF_RANGE" },
      { key: "relevantPain", reason: "EMPTY" },
    ],
  );
  assert.deepEqual(persisted, before, "la lectura no reescribe D1");
});

test("C10 conserva el valor anterior ante edición local inválida", async () => {
  const { DEFAULT_ACTIVE_THRESHOLDS, normalizeThresholdRecord } =
    await domainPromise;
  const previous = { ...DEFAULT_ACTIVE_THRESHOLDS, relevantPain: 6 };
  const normalized = normalizeThresholdRecord(
    { ...previous, relevantPain: "" },
    previous,
  );
  assert.equal(normalized.thresholds.relevantPain, 6);
  assert.equal(normalized.normalizations.length, 1);
});
