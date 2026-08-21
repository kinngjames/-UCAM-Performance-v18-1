import assert from "node:assert/strict";
import test from "node:test";
import {
  proveV181AdversarialV3Sensitivity,
  verifyV181AdversarialV3,
} from "../scripts/v18.1-adversarial-v3.mjs";

test("fixture v3 fija guardas nulas, configuración y esfuerzos incompletos", async () => {
  const result = await verifyV181AdversarialV3();
  assert.equal(result.output.length, 7);
  const byCase = new Map(result.output.map((item) => [item.caseId, item.metric]));
  assert.deepEqual(byCase.get("T2-MISSING").signals, []);
  assert.deepEqual(byCase.get("T2-BELOW").signals, []);
  assert.deepEqual(
    byCase.get("T2-ABOVE").signals.map(({ key }) => key),
    ["fatigue", "pain"],
  );
  for (const id of ["M1", "M2", "M3", "M4"])
    assert.equal(byCase.get(id).loadCompleteness, "PARTIAL");
  assert.deepEqual(
    [
      byCase.get("M3").expectedLoadEfforts,
      byCase.get("M3").completedLoadEfforts,
    ],
    [2, 1],
  );
});

test("sensibilidad v3 detecta específicamente la regresión C9", async () => {
  const sensitivity = await proveV181AdversarialV3Sensitivity();
  assert.equal(sensitivity.correct, "PASS");
  assert.equal(sensitivity.mutant, "FAIL");
});
