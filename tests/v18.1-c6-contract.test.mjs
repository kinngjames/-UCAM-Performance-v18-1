import assert from "node:assert/strict";
import test from "node:test";
import { characterizeBlock2C6Contract } from "../scripts/block2-c6-contract.mjs";

test("el estadio contractual C6 permanece caracterizado tras avanzar a C7", async () => {
  const result = await characterizeBlock2C6Contract();
  assert.equal(result.demo.metrics, 760);
  assert.equal(result.demo.immutableDifferences, 0);
  assert.equal(result.demo.unexpectedDifferences, 0);
  assert.deepEqual(result.demo.changedFields, {
    reasons: 3,
    recordCompleteness: 760,
    signals: 3,
    status: 7,
  });
  assert.equal(result.demo.signals, 109);
  assert.deepEqual(result.demo.status, {
    OK: 659,
    REVISAR: 7,
    VIGILAR: 90,
    null: 4,
  });
  assert.deepEqual(result.demo.recordCompleteness, {
    COMPLETE: 753,
    NOT_EXPECTED: 4,
    PARTIAL: 3,
    NO_DATA: 0,
  });
  assert.equal(result.fixture.metrics, 10);
  assert.equal(result.fixture.immutableDifferences, 0);
  assert.equal(result.fixture.unexpectedDifferences, 0);
  assert.deepEqual(result.fixture.changedFields, {
    reasons: 2,
    recordCompleteness: 10,
    signals: 2,
    status: 3,
  });
});
