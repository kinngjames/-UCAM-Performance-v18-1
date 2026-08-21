import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { serializeCanonicalJson, sha256Utf8 } from "../scripts/canonical-json.mjs";
import {
  PRE_F2_V181_GOLDEN_SHA256,
  V181_F2_GOLDEN_PATH,
  V181_F2_GOLDEN_SHA256,
  V181_F2_MANIFEST_PATH,
  verifyV181F2Contract,
} from "../scripts/v18.1-f2-golden.mjs";

test("C12 retira sessions y ninguna otra diferencia en 760 métricas", async () => {
  const result = await verifyV181F2Contract();
  assert.equal(result.baseline.metrics.length, 760);
  assert.equal(result.previous.length, 760);
  assert.equal(result.immutableDifferences, 0);
  assert.equal(result.unexpectedDifferences, 0);
  assert.equal(result.signals, 105);
  assert.deepEqual(result.status, {
    OK: 663,
    REVISAR: 7,
    VIGILAR: 86,
    null: 4,
  });
  assert.ok(
    result.baseline.metrics.every(
      (metric) =>
        Object.keys(metric).length === 39 &&
        !Object.hasOwn(metric, "sessions"),
    ),
  );
});

test("golden F2 es canónico, tiene SHA propio y conserva el anterior", async () => {
  const [contents, manifestContents, previousContents] = await Promise.all([
    readFile(V181_F2_GOLDEN_PATH, "utf8"),
    readFile(V181_F2_MANIFEST_PATH, "utf8"),
    readFile(
      new URL("./fixtures/v18.1-final-player-metrics.json", import.meta.url),
      "utf8",
    ),
  ]);
  assert.equal(contents, serializeCanonicalJson(JSON.parse(contents)));
  assert.equal(manifestContents, serializeCanonicalJson(JSON.parse(manifestContents)));
  assert.equal(sha256Utf8(contents), V181_F2_GOLDEN_SHA256);
  assert.equal(sha256Utf8(previousContents), PRE_F2_V181_GOLDEN_SHA256);
  const manifest = JSON.parse(manifestContents);
  assert.equal(manifest.goldenSha256, V181_F2_GOLDEN_SHA256);
  assert.equal(manifest.metrics, 760);
  assert.equal(manifest.playerMetricFields.length, 39);
  assert.deepEqual(manifest.previousV181.retiredFields, ["sessions"]);
  assert.deepEqual(
    [manifest.determinism.shaA, manifest.determinism.shaB, manifest.determinism.shaC],
    [V181_F2_GOLDEN_SHA256, V181_F2_GOLDEN_SHA256, V181_F2_GOLDEN_SHA256],
  );
});
