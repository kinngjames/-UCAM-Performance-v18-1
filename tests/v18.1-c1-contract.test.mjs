import assert from "node:assert/strict";
import test from "node:test";
import { verifyBlock2C1Contract } from "../scripts/block2-c1-contract.mjs";

test("C1 coincide exactamente con el estadio contractual aprobado", async () => {
  const result = await verifyBlock2C1Contract();
  assert.deepEqual(result.preGate.map((row) => row.key), ["12-P05", "27-P14"]);
  assert.equal(result.demo.metrics, 760);
  assert.equal(result.demo.immutableDifferences, 0);
  assert.equal(result.demo.unexpectedDifferences, 0);
  assert.equal(result.demo.pendingChanges, 2);
  assert.equal(result.demo.statusChanges, 2);
  assert.equal(result.demo.signalsBefore, 114);
  assert.equal(result.demo.signalsAfter, 112);
  assert.equal(result.fixture.metrics, 10);
  assert.equal(result.fixture.immutableDifferences, 0);
  assert.equal(result.fixture.unexpectedDifferences, 0);
  assert.equal(result.fixture.pendingChanges, 1);
  assert.equal(result.fixture.statusChanges, 1);
});
