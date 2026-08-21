import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { verifyBlock2C5Contract } from "../scripts/block2-c5-contract.mjs";
import {
  serializeCanonicalJson,
  sha256Utf8,
} from "../scripts/canonical-json.mjs";
import {
  runCurrentMetricsOnV18AdversarialFixture,
  V18_ADVERSARIAL_INPUT_SHA256,
  V18_ADVERSARIAL_OUTPUT_SHA256,
} from "../scripts/v18-adversarial.mjs";
import { buildV18Baseline, V18_DATASET_SHA256 } from "../scripts/v18-baseline.mjs";
import { V18_GOLDEN_V2_SHA256 } from "../scripts/v18-golden.mjs";
import {
  V181_ADVERSARIAL_OUTPUT_PATH,
  V181_ADVERSARIAL_OUTPUT_SHA256,
} from "../scripts/v18.1-adversarial.mjs";
import {
  V181_GOLDEN_SHA256,
  V181_GOLDEN_PATH,
  V181_MANIFEST_PATH,
} from "../scripts/v18.1-golden.mjs";

const V181_FIELDS = [
  "availability",
  "availabilityKnown",
  "avgRpe",
  "compensatoryLoad",
  "completed",
  "completedLoadEfforts",
  "convocation",
  "expectedLoadEfforts",
  "fatigue",
  "load",
  "loadCompleteness",
  "matchLoad",
  "matchMinutes",
  "matchRpe",
  "minutes",
  "mood",
  "pain",
  "pending",
  "personalRpe",
  "personalSleep",
  "playerId",
  "reasons",
  "recordCompleteness",
  "rpeCompleted",
  "rpeExpected",
  "rpeRange",
  "sessions",
  "signals",
  "sleep",
  "sleepRange",
  "status",
  "stress",
  "trained",
  "trainingLoad",
  "trainingMinutes",
  "weekId",
  "wellbeingDone",
  "wellbeingExpected",
  "zRpe",
  "zSleep",
];
const REMOVED_FIELDS = [
  "chronic",
  "compliance",
  "ewma",
  "monotony",
  "plannedTotalLoad",
  "plannedTrainingLoad",
  "ratio",
  "strain",
  "streak",
];
const MODIFIED_FIELDS = [
  "pending",
  "reasons",
  "rpeRange",
  "signals",
  "sleepRange",
  "status",
  "zRpe",
  "zSleep",
];
const UNCHANGED_FIELDS = [
  "availability",
  "availabilityKnown",
  "avgRpe",
  "compensatoryLoad",
  "completed",
  "completedLoadEfforts",
  "convocation",
  "expectedLoadEfforts",
  "fatigue",
  "load",
  "loadCompleteness",
  "matchLoad",
  "matchMinutes",
  "matchRpe",
  "minutes",
  "mood",
  "pain",
  "personalRpe",
  "personalSleep",
  "playerId",
  "rpeCompleted",
  "rpeExpected",
  "sessions",
  "sleep",
  "stress",
  "trained",
  "trainingLoad",
  "trainingMinutes",
  "weekId",
  "wellbeingDone",
];

test("los seis anclajes y ambos outputs v18.1 conservan bytes canónicos", async () => {
  const [goldenContents, fixtureContents, manifestContents] = await Promise.all([
    readFile(V181_GOLDEN_PATH, "utf8"),
    readFile(V181_ADVERSARIAL_OUTPUT_PATH, "utf8"),
    readFile(V181_MANIFEST_PATH, "utf8"),
  ]);
  assert.equal(
    goldenContents,
    serializeCanonicalJson(JSON.parse(goldenContents)),
  );
  assert.equal(
    fixtureContents,
    serializeCanonicalJson(JSON.parse(fixtureContents)),
  );
  assert.equal(
    manifestContents,
    serializeCanonicalJson(JSON.parse(manifestContents)),
  );
  assert.equal(sha256Utf8(goldenContents), V181_GOLDEN_SHA256);
  assert.equal(sha256Utf8(fixtureContents), V181_ADVERSARIAL_OUTPUT_SHA256);
  assert.equal(V18_DATASET_SHA256, "2d30cadd2469c1a6e4c3eef2331a92bf424795ff50826d319a2b1c57150a509b");
  assert.equal(V18_GOLDEN_V2_SHA256, "c24421e7afed99ee483930a340e724440d8285a361fa26b2673622de69d5b7b4");
  assert.equal(V18_ADVERSARIAL_INPUT_SHA256, "00fb9f767a9155d637ef5b68154d4f663db3b67a7f01e0a0442263b5ee76e23b");
  assert.equal(V18_ADVERSARIAL_OUTPUT_SHA256, "aa5090b824c00635966fb42edc77f8fe544b093bf278ba8e4210ba4353d5bd6d");
  assert.deepEqual(JSON.parse(manifestContents), {
    datasetSha256: V18_DATASET_SHA256,
    format: "canonical-json-v1",
    goldenFilename: "v18.1-final-player-metrics.json",
    goldenSha256: V181_GOLDEN_SHA256,
    historicalV18: {
      fixtureInputSha256: V18_ADVERSARIAL_INPUT_SHA256,
      fixtureOutputSha256: V18_ADVERSARIAL_OUTPUT_SHA256,
      goldenSha256: V18_GOLDEN_V2_SHA256,
    },
    metrics: 760,
    playerMetricFields: V181_FIELDS,
    provisionalV181: {
      goldenFilename: "v18.1-player-metrics.json",
      goldenSha256:
        "7d72932658949742d528e9d2c904e3fed21f0075326044b4e456e2dda40e8b58",
      retiredFields: ["monotony", "strain"],
    },
    signals: 105,
    status: { OK: 663, REVISAR: 7, VIGILAR: 86, null: 4 },
    version: "v18.1-final",
  });
});

test("el golden v18.1 fija exactamente el contrato público de PlayerMetric", async () => {
  const metrics = JSON.parse(await readFile(V181_GOLDEN_PATH, "utf8"));
  assert.equal(metrics.length, 760);
  assert.equal(new Set(metrics.map((metric) => metric.playerId)).size, 20);
  assert.equal(new Set(metrics.map((metric) => metric.weekId)).size, 38);
  assert.equal(
    new Set(metrics.map((metric) => Object.keys(metric).sort().join("|"))).size,
    1,
  );
  assert.deepEqual(Object.keys(metrics[0]).sort(), V181_FIELDS);
  for (const metric of metrics) {
    for (const field of REMOVED_FIELDS) {
      assert.equal(Object.hasOwn(metric, field), false, `${metric.weekId}-${metric.playerId}: ${field}`);
    }
    assert.equal(Object.hasOwn(metric, "wellbeingExpected"), true);
    assert.equal(Object.hasOwn(metric, "recordCompleteness"), true);
    assert.equal(Object.hasOwn(metric, "monotony"), false);
    assert.equal(Object.hasOwn(metric, "strain"), false);
  }
});

test("la clasificación de campos v18 a v18.1 es completa y exacta", async () => {
  const [historical, current] = await Promise.all([
    readFile(
      new URL("./fixtures/v18-original-player-metrics.v2.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(V181_GOLDEN_PATH, "utf8").then(JSON.parse),
  ]);
  const historicalFields = new Set(Object.keys(historical[0]));
  const currentFields = new Set(Object.keys(current[0]));
  const removed = [...historicalFields]
    .filter((field) => !currentFields.has(field))
    .sort();
  const added = [...currentFields]
    .filter((field) => !historicalFields.has(field))
    .sort();
  const shared = [...currentFields].filter((field) => historicalFields.has(field));
  const historicalByKey = new Map(
    historical.map((metric) => [`${metric.weekId}-${metric.playerId}`, metric]),
  );
  const modified = [];
  const unchanged = [];
  for (const field of shared) {
    const changed = current.some((metric) => {
      const historicalMetric = historicalByKey.get(
        `${metric.weekId}-${metric.playerId}`,
      );
      assert.ok(historicalMetric);
      return (
        serializeCanonicalJson(metric[field]) !==
        serializeCanonicalJson(historicalMetric[field])
      );
    });
    (changed ? modified : unchanged).push(field);
  }
  assert.deepEqual(removed, REMOVED_FIELDS);
  assert.deepEqual(added, ["recordCompleteness", "wellbeingExpected"]);
  assert.deepEqual(modified.sort(), MODIFIED_FIELDS);
  assert.deepEqual(unchanged.sort(), UNCHANGED_FIELDS);
});

test("golden y fixture v18.1 proceden del motor que pasa la matriz final", async () => {
  const contract = await verifyBlock2C5Contract();
  assert.equal(contract.demo.immutableDifferences, 0);
  assert.equal(contract.demo.unexpectedDifferences, 0);
  assert.equal(contract.fixture.immutableDifferences, 0);
  assert.equal(contract.fixture.unexpectedDifferences, 0);

  const [baseline, fixture, goldenContents, fixtureContents] = await Promise.all([
    buildV18Baseline(),
    runCurrentMetricsOnV18AdversarialFixture(),
    readFile(V181_GOLDEN_PATH, "utf8"),
    readFile(V181_ADVERSARIAL_OUTPUT_PATH, "utf8"),
  ]);
  assert.equal(serializeCanonicalJson(baseline.metrics), goldenContents);
  assert.equal(fixture.outputContents, fixtureContents);
  assert.equal(fixture.output.length, 10);

  const [pageSource, harnessSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../scripts/metrics-characterization.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(pageSource, /from "\.\.\/domain\/metrics";/);
  assert.match(harnessSource, /ssrLoadModule\("\/domain\/metrics\/index\.ts"\)/);
});

test("la escritura del golden exige el verificador antes de generar bytes", async () => {
  const source = await readFile(
    new URL("../scripts/v18.1-golden.mjs", import.meta.url),
    "utf8",
  );
  const generate = source.slice(
    source.indexOf("export async function generateV181Golden"),
    source.indexOf("export async function finalizeV181Golden"),
  );
  const finalize = source.slice(
    source.indexOf("export async function finalizeV181Golden"),
    source.indexOf("async function main"),
  );
  assert.ok(generate.indexOf("await assertPreGate()") < generate.indexOf("writeExclusive"));
  assert.ok(finalize.indexOf("await assertPreGate()") < finalize.indexOf("copyFile"));
  assert.notEqual(
    sha256Utf8(serializeCanonicalJson({ value: null })),
    sha256Utf8(serializeCanonicalJson({})),
  );
});
