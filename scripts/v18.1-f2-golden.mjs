import assert from "node:assert/strict";
import { constants } from "node:fs";
import { copyFile, open, readFile, unlink } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  C1_IMMUTABLE_FIELDS,
  topLevelDifferences,
} from "./block2-c1-contract.mjs";
import { serializeCanonicalJson, sha256Utf8 } from "./canonical-json.mjs";
import { buildV18Baseline, V18_DATASET_SHA256 } from "./v18-baseline.mjs";
import { V18_GOLDEN_V2_SHA256 } from "./v18-golden.mjs";

export const PRE_F2_V181_GOLDEN_PATH = new URL(
  "../tests/fixtures/v18.1-final-player-metrics.json",
  import.meta.url,
);
export const PRE_F2_V181_GOLDEN_SHA256 =
  "08d8c2a0d681f44b71cf0264e49891eb44ce455c792306370382c0ab5fb62c9e";
export const V181_F2_GOLDEN_PATH = new URL(
  "../tests/fixtures/v18.1-f2-player-metrics.json",
  import.meta.url,
);
export const V181_F2_MANIFEST_PATH = new URL(
  "../tests/fixtures/v18.1-f2-player-metrics.manifest.json",
  import.meta.url,
);
export const V181_F2_GOLDEN_SHA256 =
  "b830d1db980e95625180300bb5f8ab1a280e11adf16a628cff338e41e3dff463";

const V18_FIXTURE_INPUT_SHA256 =
  "00fb9f767a9155d637ef5b68154d4f663db3b67a7f01e0a0442263b5ee76e23b";
const V18_FIXTURE_OUTPUT_SHA256 =
  "aa5090b824c00635966fb42edc77f8fe544b093bf278ba8e4210ba4353d5bd6d";

const statusCounts = (metrics) =>
  Object.fromEntries(
    metrics.reduce((counts, metric) => {
      const key = metric.status === null ? "null" : metric.status;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts;
    }, new Map()),
  );

const withoutSessions = (metrics) =>
  metrics.map((metric) => {
    const expected = structuredClone(metric);
    delete expected.sessions;
    return expected;
  });

const assertExplicitF2Filename = (path) => {
  const filename = basename(path);
  if (!filename.includes("v18.1") || !filename.includes("f2")) {
    throw new Error(`Golden v18.1 F2: nombre no explícito (${path})`);
  }
};

const writeExclusive = async (path, contents) => {
  const handle = await open(path, "wx");
  try {
    await handle.writeFile(contents, "utf8");
  } finally {
    await handle.close();
  }
};

export async function verifyV181F2Contract() {
  const previousContents = await readFile(PRE_F2_V181_GOLDEN_PATH, "utf8");
  assert.equal(
    sha256Utf8(previousContents),
    PRE_F2_V181_GOLDEN_SHA256,
    "Golden v18.1 de 40 campos modificado",
  );
  const previous = JSON.parse(previousContents);
  assert.equal(previous.length, 760);
  assert.equal(
    previous.filter((metric) => metric.sessions === metric.completed).length,
    760,
    "sessions debe ser alias exacto de completed antes de retirarlo",
  );

  const baseline = await buildV18Baseline();
  assert.equal(baseline.datasetSha256, V18_DATASET_SHA256);
  assert.equal(baseline.metrics.length, 760);
  const expected = withoutSessions(previous);
  assert.equal(
    serializeCanonicalJson(baseline.metrics),
    serializeCanonicalJson(expected),
    "F2 permite retirar sessions y ninguna otra diferencia",
  );

  let immutableDifferences = 0;
  let unexpectedDifferences = 0;
  for (let index = 0; index < baseline.metrics.length; index += 1) {
    const before = previous[index];
    const after = baseline.metrics[index];
    immutableDifferences += C1_IMMUTABLE_FIELDS.filter(
      (field) =>
        serializeCanonicalJson(before[field]) !==
        serializeCanonicalJson(after[field]),
    ).length;
    const differences = topLevelDifferences(before, after);
    unexpectedDifferences += differences.filter(
      (field) => field !== "sessions",
    ).length;
    assert.deepEqual(differences, ["sessions"]);
  }
  assert.equal(immutableDifferences, 0);
  assert.equal(unexpectedDifferences, 0);

  const signals = baseline.metrics.reduce(
    (total, metric) => total + metric.signals.length,
    0,
  );
  const status = statusCounts(baseline.metrics);
  assert.equal(signals, 105);
  assert.deepEqual(status, {
    OK: 663,
    REVISAR: 7,
    VIGILAR: 86,
    null: 4,
  });
  assert.equal(Object.keys(baseline.metrics[0]).length, 39);
  assert.ok(
    baseline.metrics.every((metric) => !Object.hasOwn(metric, "sessions")),
  );
  return {
    baseline,
    immutableDifferences,
    previous,
    signals,
    status,
    unexpectedDifferences,
  };
}

export async function generateV181F2Golden(outputPath) {
  assertExplicitF2Filename(outputPath);
  const contract = await verifyV181F2Contract();
  const contents = serializeCanonicalJson(contract.baseline.metrics);
  const goldenSha256 = sha256Utf8(contents);
  assert.equal(goldenSha256, V181_F2_GOLDEN_SHA256);
  await writeExclusive(outputPath, contents);
  assert.equal(sha256Utf8(await readFile(outputPath, "utf8")), goldenSha256);
  return {
    fields: Object.keys(contract.baseline.metrics[0]).length,
    goldenSha256,
    metrics: contract.baseline.metrics.length,
  };
}

export async function finalizeV181F2Golden(runAPath, runBPath, runCPath) {
  const contract = await verifyV181F2Contract();
  const [runA, runB, runC] = await Promise.all(
    [runAPath, runBPath, runCPath].map((path) => readFile(path, "utf8")),
  );
  for (const contents of [runA, runB, runC]) {
    assert.equal(contents, serializeCanonicalJson(JSON.parse(contents)));
    assert.equal(sha256Utf8(contents), V181_F2_GOLDEN_SHA256);
  }
  assert.equal(runA, runB);
  assert.equal(runA, runC);
  assert.equal(runA, serializeCanonicalJson(contract.baseline.metrics));

  const finalPath = fileURLToPath(V181_F2_GOLDEN_PATH);
  const manifestPath = fileURLToPath(V181_F2_MANIFEST_PATH);
  assertExplicitF2Filename(finalPath);
  assertExplicitF2Filename(manifestPath);
  await copyFile(runAPath, finalPath, constants.COPYFILE_EXCL);
  let manifestWritten = false;
  try {
    const metrics = JSON.parse(runA);
    const manifest = {
      datasetSha256: V18_DATASET_SHA256,
      determinism: {
        nodeA: "24.19.0",
        nodeB: "24.19.0",
        nodeC: "22.13.0",
        shaA: V181_F2_GOLDEN_SHA256,
        shaB: V181_F2_GOLDEN_SHA256,
        shaC: V181_F2_GOLDEN_SHA256,
      },
      format: "canonical-json-v1",
      goldenFilename: basename(finalPath),
      goldenSha256: V181_F2_GOLDEN_SHA256,
      historicalV18: {
        fixtureInputSha256: V18_FIXTURE_INPUT_SHA256,
        fixtureOutputSha256: V18_FIXTURE_OUTPUT_SHA256,
        goldenSha256: V18_GOLDEN_V2_SHA256,
      },
      metrics: metrics.length,
      playerMetricFields: Object.keys(metrics[0]).sort(),
      previousV181: {
        goldenFilename: basename(fileURLToPath(PRE_F2_V181_GOLDEN_PATH)),
        goldenSha256: PRE_F2_V181_GOLDEN_SHA256,
        retiredFields: ["sessions"],
      },
      signals: contract.signals,
      status: contract.status,
      version: "v18.1-f2-39-fields",
    };
    await writeExclusive(manifestPath, serializeCanonicalJson(manifest));
    manifestWritten = true;
    assert.equal(sha256Utf8(await readFile(finalPath, "utf8")), V181_F2_GOLDEN_SHA256);
    return {
      finalPath,
      goldenSha256: V181_F2_GOLDEN_SHA256,
      manifestPath,
      shaA: sha256Utf8(runA),
      shaB: sha256Utf8(runB),
      shaC: sha256Utf8(runC),
    };
  } finally {
    if (!manifestWritten) await unlink(finalPath).catch(() => {});
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "--generate" && args.length === 1) {
    process.stdout.write(
      `${JSON.stringify(await generateV181F2Golden(resolve(args[0])))}\n`,
    );
    return;
  }
  if (command === "--finalize" && args.length === 3) {
    process.stdout.write(
      `${JSON.stringify(
        await finalizeV181F2Golden(
          resolve(args[0]),
          resolve(args[1]),
          resolve(args[2]),
        ),
      )}\n`,
    );
    return;
  }
  throw new Error(
    "Uso: --generate <ruta-v18.1-f2> | --finalize <run-a> <run-b> <run-c>",
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
