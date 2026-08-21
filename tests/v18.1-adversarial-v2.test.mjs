import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  proveV181AdversarialV2Sensitivity,
  verifyV181AdversarialV2,
  V181_ADVERSARIAL_V2_INPUT_PATH,
  V181_ADVERSARIAL_V2_INPUT_SHA256,
  V181_ADVERSARIAL_V2_OUTPUT_PATH,
  V181_ADVERSARIAL_V2_OUTPUT_SHA256,
} from "../scripts/v18.1-adversarial-v2.mjs";
import {
  serializeCanonicalJson,
  sha256Utf8,
} from "../scripts/canonical-json.mjs";

test("fixture v18.1 v2 usa bytes canónicos y hashes fijados", async () => {
  const [input, output] = await Promise.all([
    readFile(V181_ADVERSARIAL_V2_INPUT_PATH, "utf8"),
    readFile(V181_ADVERSARIAL_V2_OUTPUT_PATH, "utf8"),
  ]);
  assert.equal(input, serializeCanonicalJson(JSON.parse(input)));
  assert.equal(output, serializeCanonicalJson(JSON.parse(output)));
  assert.equal(sha256Utf8(input), V181_ADVERSARIAL_V2_INPUT_SHA256);
  assert.equal(sha256Utf8(output), V181_ADVERSARIAL_V2_OUTPUT_SHA256);
});

test("una señal pain/review gana a NOT_EXPECTED en el motor de producción", async () => {
  const result = await verifyV181AdversarialV2();
  assert.equal(result.metrics, 1);
  assert.equal(result.inputSha256, V181_ADVERSARIAL_V2_INPUT_SHA256);
  assert.equal(result.outputSha256, V181_ADVERSARIAL_V2_OUTPUT_SHA256);
  const [metric] = result.output;
  assert.equal(metric.wellbeingExpected, 0);
  assert.equal(metric.wellbeingDone, true);
  assert.equal(metric.pain, 5);
  assert.equal(metric.pending, 0);
  assert.equal(metric.recordCompleteness, "NOT_EXPECTED");
  assert.equal(metric.status, "REVISAR");
  assert.deepEqual(metric.reasons, ["Dolor relevante registrado"]);
  assert.deepEqual(metric.signals.map(({ key, severity }) => ({ key, severity })), [
    { key: "pain", severity: "review" },
  ]);
});

test("la sensibilidad detecta que NOT_EXPECTED gane incorrectamente", async () => {
  const result = await verifyV181AdversarialV2();
  assert.deepEqual(proveV181AdversarialV2Sensitivity(result.output), {
    detectedMutation: "NOT_EXPECTED gana incorrectamente a signal pain/review",
    scope: "mutación esperada; no es cobertura exhaustiva",
  });
});

test("fixture v2 atraviesa el mismo buildMetrics importado por producción", async () => {
  const [page, harness, fixture] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../scripts/metrics-characterization.mjs", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../scripts/v18.1-adversarial-v2.mjs", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(page, /from "\.\.\/domain\/metrics";/);
  assert.match(harness, /ssrLoadModule\("\/domain\/metrics\/index\.ts"\)/);
  assert.match(fixture, /withCurrentMetricsEngine\(\(\{ buildMetrics \}\)/);
  assert.doesNotMatch(fixture, /deriveMetricSignals|registrationPending/);
});
