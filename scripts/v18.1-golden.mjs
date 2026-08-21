import assert from "node:assert/strict";
import { constants } from "node:fs";
import { copyFile, open, readFile, unlink } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyBlock2C5Contract } from "./block2-c5-contract.mjs";
import { serializeCanonicalJson, sha256Utf8 } from "./canonical-json.mjs";
import { buildV18Baseline, V18_DATASET_SHA256 } from "./v18-baseline.mjs";
import { V18_GOLDEN_V2_SHA256 } from "./v18-golden.mjs";

export const V181_GOLDEN_PATH = new URL(
  "../tests/fixtures/v18.1-player-metrics.json",
  import.meta.url,
);
export const V181_MANIFEST_PATH = new URL(
  "../tests/fixtures/v18.1-player-metrics.manifest.json",
  import.meta.url,
);

const V18_FIXTURE_INPUT_SHA256 =
  "00fb9f767a9155d637ef5b68154d4f663db3b67a7f01e0a0442263b5ee76e23b";
const V18_FIXTURE_OUTPUT_SHA256 =
  "aa5090b824c00635966fb42edc77f8fe544b093bf278ba8e4210ba4353d5bd6d";
const BLOCK2_FINAL_TREE_SHA1 =
  "840748353257ad865e0f10c16bf2cdda171660ab";

const statusCounts = (metrics) =>
  Object.fromEntries(
    metrics.reduce((counts, metric) => {
      const key = metric.status === null ? "null" : metric.status;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts;
    }, new Map()),
  );

const assertPreGate = async () => {
  const contract = await verifyBlock2C5Contract();
  assert.equal(contract.datasetSha256, V18_DATASET_SHA256);
  assert.equal(contract.demo.metrics, 760);
  assert.equal(contract.fixture.metrics, 10);
  assert.equal(contract.demo.immutableDifferences, 0);
  assert.equal(contract.fixture.immutableDifferences, 0);
  assert.equal(contract.demo.unexpectedDifferences, 0);
  assert.equal(contract.fixture.unexpectedDifferences, 0);
  assert.equal(contract.demo.signals, 105);
  assert.deepEqual(contract.demo.status, {
    OK: 663,
    REVISAR: 7,
    VIGILAR: 86,
    null: 4,
  });
  assert.equal(contract.historical.goldenSha256, V18_GOLDEN_V2_SHA256);
  assert.equal(
    contract.historical.fixtureInputSha256,
    V18_FIXTURE_INPUT_SHA256,
  );
  assert.equal(
    contract.historical.fixtureOutputSha256,
    V18_FIXTURE_OUTPUT_SHA256,
  );
  return contract;
};

const writeExclusive = async (path, contents) => {
  const handle = await open(path, "wx");
  try {
    await handle.writeFile(contents, "utf8");
  } finally {
    await handle.close();
  }
};

const assertV181Filename = (path) => {
  if (!basename(path).includes("v18.1")) {
    throw new Error(`Golden v18.1: nombre no explícito (${path})`);
  }
};

export async function generateV181Golden(outputPath) {
  assertV181Filename(outputPath);
  await assertPreGate();
  const baseline = await buildV18Baseline();
  assert.equal(baseline.datasetSha256, V18_DATASET_SHA256);
  assert.equal(baseline.metrics.length, 760);
  assert.equal(
    baseline.metrics.reduce(
      (total, metric) => total + metric.signals.length,
      0,
    ),
    105,
  );
  assert.deepEqual(statusCounts(baseline.metrics), {
    OK: 663,
    REVISAR: 7,
    VIGILAR: 86,
    null: 4,
  });
  const contents = serializeCanonicalJson(baseline.metrics);
  const goldenSha256 = sha256Utf8(contents);
  await writeExclusive(outputPath, contents);
  assert.equal(sha256Utf8(await readFile(outputPath, "utf8")), goldenSha256);
  return { goldenSha256, metrics: baseline.metrics.length };
}

export async function finalizeV181Golden(runAPath, runBPath) {
  await assertPreGate();
  const [runA, runB] = await Promise.all([
    readFile(runAPath, "utf8"),
    readFile(runBPath, "utf8"),
  ]);
  assert.equal(runA, serializeCanonicalJson(JSON.parse(runA)));
  assert.equal(runB, serializeCanonicalJson(JSON.parse(runB)));
  const shaA = sha256Utf8(runA);
  const shaB = sha256Utf8(runB);
  assert.equal(shaA, shaB, "Golden v18.1: A y B no son idénticos");

  const finalPath = fileURLToPath(V181_GOLDEN_PATH);
  const manifestPath = fileURLToPath(V181_MANIFEST_PATH);
  assertV181Filename(finalPath);
  assertV181Filename(manifestPath);
  await copyFile(runAPath, finalPath, constants.COPYFILE_EXCL);
  let manifestWritten = false;
  try {
    const metrics = JSON.parse(runA);
    const manifest = {
      block2FinalTreeSha1: BLOCK2_FINAL_TREE_SHA1,
      datasetSha256: V18_DATASET_SHA256,
      format: "canonical-json-v1",
      goldenFilename: basename(finalPath),
      goldenSha256: shaA,
      historicalV18: {
        fixtureInputSha256: V18_FIXTURE_INPUT_SHA256,
        fixtureOutputSha256: V18_FIXTURE_OUTPUT_SHA256,
        goldenSha256: V18_GOLDEN_V2_SHA256,
      },
      metrics: metrics.length,
      signals: metrics.reduce(
        (total, metric) => total + metric.signals.length,
        0,
      ),
      status: statusCounts(metrics),
      version: "v18.1",
    };
    await writeExclusive(manifestPath, serializeCanonicalJson(manifest));
    manifestWritten = true;
    const finalContents = await readFile(finalPath, "utf8");
    assert.equal(finalContents, runA);
    assert.equal(sha256Utf8(finalContents), shaA);
    return { finalPath, goldenSha256: shaA, manifestPath, shaA, shaB };
  } finally {
    if (!manifestWritten) await unlink(finalPath).catch(() => {});
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "--generate" && args.length === 1) {
    const result = await generateV181Golden(resolve(args[0]));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (command === "--finalize" && args.length === 2) {
    const result = await finalizeV181Golden(
      resolve(args[0]),
      resolve(args[1]),
    );
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  throw new Error(
    "Uso: --generate <ruta-v18.1> | --finalize <run-a> <run-b>",
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
