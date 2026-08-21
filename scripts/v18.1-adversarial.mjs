import assert from "node:assert/strict";
import { constants } from "node:fs";
import { copyFile, open, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyBlock2C5Contract } from "./block2-c5-contract.mjs";
import { serializeCanonicalJson, sha256Utf8 } from "./canonical-json.mjs";
import {
  runCurrentMetricsOnV18AdversarialFixture,
  V18_ADVERSARIAL_INPUT_SHA256,
  V18_ADVERSARIAL_OUTPUT_SHA256,
} from "./v18-adversarial.mjs";

export const V181_ADVERSARIAL_OUTPUT_PATH = new URL(
  "../tests/fixtures/v18.1-adversarial-output.json",
  import.meta.url,
);
export const V181_ADVERSARIAL_OUTPUT_SHA256 =
  "537b8f79f471f5dd311d66e74ee1b3b0406d4a7b8d181a065c46e7b0d63b49c8";

const assertPreGate = async () => {
  const contract = await verifyBlock2C5Contract();
  assert.equal(contract.fixture.metrics, 10);
  assert.equal(contract.fixture.immutableDifferences, 0);
  assert.equal(contract.fixture.unexpectedDifferences, 0);
  assert.equal(
    contract.historical.fixtureInputSha256,
    V18_ADVERSARIAL_INPUT_SHA256,
  );
  assert.equal(
    contract.historical.fixtureOutputSha256,
    V18_ADVERSARIAL_OUTPUT_SHA256,
  );
};

const assertV181Filename = (path) => {
  if (!basename(path).includes("v18.1")) {
    throw new Error(`Fixture v18.1: nombre no explícito (${path})`);
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

export async function generateV181Adversarial(outputPath) {
  assertV181Filename(outputPath);
  await assertPreGate();
  const current = await runCurrentMetricsOnV18AdversarialFixture();
  assert.equal(current.inputSha256, V18_ADVERSARIAL_INPUT_SHA256);
  assert.equal(current.output.length, 10);
  assert.equal(
    current.outputContents,
    serializeCanonicalJson(current.output),
  );
  assert.equal(current.outputSha256, V181_ADVERSARIAL_OUTPUT_SHA256);
  await writeExclusive(outputPath, current.outputContents);
  assert.equal(
    sha256Utf8(await readFile(outputPath, "utf8")),
    V181_ADVERSARIAL_OUTPUT_SHA256,
  );
  return {
    inputSha256: current.inputSha256,
    metrics: current.output.length,
    outputSha256: current.outputSha256,
  };
}

export async function finalizeV181Adversarial(runAPath, runBPath) {
  await assertPreGate();
  const [runA, runB] = await Promise.all([
    readFile(runAPath, "utf8"),
    readFile(runBPath, "utf8"),
  ]);
  assert.equal(runA, serializeCanonicalJson(JSON.parse(runA)));
  assert.equal(runB, serializeCanonicalJson(JSON.parse(runB)));
  assert.equal(runA, runB, "Fixture v18.1: A y B no son idénticos");
  assert.equal(sha256Utf8(runA), V181_ADVERSARIAL_OUTPUT_SHA256);
  const finalPath = fileURLToPath(V181_ADVERSARIAL_OUTPUT_PATH);
  assertV181Filename(finalPath);
  await copyFile(runAPath, finalPath, constants.COPYFILE_EXCL);
  assert.equal(
    sha256Utf8(await readFile(finalPath, "utf8")),
    V181_ADVERSARIAL_OUTPUT_SHA256,
  );
  return {
    finalPath,
    outputSha256: V181_ADVERSARIAL_OUTPUT_SHA256,
  };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "--generate" && args.length === 1) {
    const result = await generateV181Adversarial(resolve(args[0]));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (command === "--finalize" && args.length === 2) {
    const result = await finalizeV181Adversarial(
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
