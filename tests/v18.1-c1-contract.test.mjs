import assert from "node:assert/strict";
import test from "node:test";
import { characterizeBlock2C1Contract } from "../scripts/block2-c1-contract.mjs";

test("el estadio contractual C1 permanece caracterizado tras avanzar a C6", async () => {
  const result = await characterizeBlock2C1Contract();
  assert.equal(result.demo.metrics, 760);
  assert.equal(result.demo.immutableDifferences, 0);
  assert.equal(result.demo.unexpectedDifferences, 0);
  assert.equal(result.demo.pendingChanges, 2);
  assert.equal(result.demo.statusChanges, 2);
  assert.equal(result.fixture.metrics, 10);
  assert.equal(result.fixture.immutableDifferences, 0);
  assert.equal(result.fixture.unexpectedDifferences, 0);
  assert.equal(result.fixture.pendingChanges, 1);
  assert.equal(result.fixture.statusChanges, 1);
});
