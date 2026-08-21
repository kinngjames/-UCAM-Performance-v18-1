import assert from "node:assert/strict";
import { constants } from "node:fs";
import { copyFile, open, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serializeCanonicalJson, sha256Utf8 } from "./canonical-json.mjs";
import { withCurrentMetricsEngine } from "./metrics-characterization.mjs";

export const V181_ADVERSARIAL_V2_INPUT_PATH = new URL(
  "../tests/fixtures/v18.1-adversarial-v2-input.json",
  import.meta.url,
);
export const V181_ADVERSARIAL_V2_OUTPUT_PATH = new URL(
  "../tests/fixtures/v18.1-adversarial-v2-output.json",
  import.meta.url,
);
export const V181_ADVERSARIAL_V2_INPUT_SHA256 =
  "d60f06dbc0948541a35cd680fd9fac84315dc35d519e54fb3e22e75ddfaaaf72";
export const V181_ADVERSARIAL_V2_OUTPUT_SHA256 =
  "1421d617f0f99b5a411dce4f1f1e9e11b8ca270fdd5ed0378f64b4cf02207027";

const EXPECTED_OUTPUT = [
  {
    availability: "NO DISPONIBLE",
    availabilityKnown: true,
    avgRpe: null,
    compensatoryLoad: 0,
    completed: 0,
    completedLoadEfforts: 0,
    convocation: "NO CONVOCADO",
    expectedLoadEfforts: 0,
    fatigue: 2,
    load: 0,
    loadCompleteness: "NO_EXPOSURE",
    matchLoad: 0,
    matchMinutes: null,
    matchRpe: null,
    minutes: 0,
    mood: 4,
    pain: 5,
    pending: 0,
    personalRpe: null,
    personalSleep: null,
    playerId: "ADV-VOLUNTARY",
    reasons: ["Dolor relevante registrado"],
    recordCompleteness: "NOT_EXPECTED",
    rpeCompleted: 0,
    rpeExpected: 0,
    rpeRange: null,
    sessions: 0,
    signals: [
      {
        action: "Revisar zona, limitación y evolución.",
        data: "5,0/10",
        difference: "+1,0",
        explanation:
          "Es un dato comunicado por el jugador; no constituye un diagnóstico.",
        key: "pain",
        label: "Dolor relevante registrado",
        reference: "Umbral 4/10",
        severity: "review",
      },
    ],
    sleep: 8,
    sleepRange: null,
    status: "REVISAR",
    stress: 2,
    trained: 0,
    trainingLoad: 0,
    trainingMinutes: 0,
    weekId: 1,
    wellbeingDone: true,
    wellbeingExpected: 0,
    zRpe: null,
    zSleep: null,
  },
];

const assertExplicitV2Filename = (path) => {
  const filename = basename(path);
  if (!filename.includes("v18.1") || !filename.includes("v2")) {
    throw new Error(`Fixture v18.1 v2: nombre no explícito (${path})`);
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

const readVerifiedInput = async () => {
  const inputContents = await readFile(V181_ADVERSARIAL_V2_INPUT_PATH, "utf8");
  assert.equal(inputContents, serializeCanonicalJson(JSON.parse(inputContents)));
  assert.equal(sha256Utf8(inputContents), V181_ADVERSARIAL_V2_INPUT_SHA256);
  return { input: JSON.parse(inputContents), inputContents };
};

const runCurrentV2 = async () => {
  const { input, inputContents } = await readVerifiedInput();
  const output = await withCurrentMetricsEngine(({ buildMetrics }) => {
    const metric = buildMetrics(input).get("1-ADV-VOLUNTARY");
    assert.ok(metric, "Fixture v18.1 v2: falta 1-ADV-VOLUNTARY");
    return [metric];
  });
  assert.equal(
    serializeCanonicalJson(output),
    serializeCanonicalJson(EXPECTED_OUTPUT),
    "Fixture v18.1 v2: el motor incumple la matriz contractual",
  );
  return {
    inputSha256: sha256Utf8(inputContents),
    output,
    outputContents: serializeCanonicalJson(output),
  };
};

export const proveV181AdversarialV2Sensitivity = (output) => {
  const mutant = structuredClone(output);
  mutant[0].status = null;
  assert.throws(
    () => assert.deepEqual(mutant, EXPECTED_OUTPUT),
    /Expected values to be strictly deep-equal/,
  );
  assert.equal(
    serializeCanonicalJson(mutant) === serializeCanonicalJson(EXPECTED_OUTPUT),
    false,
  );
  return {
    detectedMutation: "NOT_EXPECTED gana incorrectamente a signal pain/review",
    scope: "mutación esperada; no es cobertura exhaustiva",
  };
};

export async function generateV181AdversarialV2(outputPath) {
  assertExplicitV2Filename(outputPath);
  const current = await runCurrentV2();
  proveV181AdversarialV2Sensitivity(current.output);
  const outputSha256 = sha256Utf8(current.outputContents);
  assert.equal(outputSha256, V181_ADVERSARIAL_V2_OUTPUT_SHA256);
  await writeExclusive(outputPath, current.outputContents);
  assert.equal(
    sha256Utf8(await readFile(outputPath, "utf8")),
    outputSha256,
  );
  return {
    inputSha256: current.inputSha256,
    metrics: current.output.length,
    outputSha256,
  };
}

export async function finalizeV181AdversarialV2(runAPath, runCPath) {
  const current = await runCurrentV2();
  proveV181AdversarialV2Sensitivity(current.output);
  const [runA, runC] = await Promise.all([
    readFile(runAPath, "utf8"),
    readFile(runCPath, "utf8"),
  ]);
  assert.equal(runA, serializeCanonicalJson(JSON.parse(runA)));
  assert.equal(runC, serializeCanonicalJson(JSON.parse(runC)));
  assert.equal(runA, runC, "Fixture v18.1 v2: Node A y C difieren");
  assert.equal(runA, current.outputContents);
  const outputSha256 = sha256Utf8(runA);
  assert.equal(outputSha256, V181_ADVERSARIAL_V2_OUTPUT_SHA256);
  const finalPath = fileURLToPath(V181_ADVERSARIAL_V2_OUTPUT_PATH);
  assertExplicitV2Filename(finalPath);
  await copyFile(runAPath, finalPath, constants.COPYFILE_EXCL);
  assert.equal(
    sha256Utf8(await readFile(finalPath, "utf8")),
    outputSha256,
  );
  return { finalPath, outputSha256 };
}

export async function verifyV181AdversarialV2() {
  const current = await runCurrentV2();
  const storedContents = await readFile(V181_ADVERSARIAL_V2_OUTPUT_PATH, "utf8");
  assert.equal(storedContents, serializeCanonicalJson(JSON.parse(storedContents)));
  assert.equal(storedContents, current.outputContents);
  assert.equal(sha256Utf8(storedContents), V181_ADVERSARIAL_V2_OUTPUT_SHA256);
  return {
    inputSha256: current.inputSha256,
    metrics: current.output.length,
    output: current.output,
    outputSha256: sha256Utf8(storedContents),
    sensitivity: proveV181AdversarialV2Sensitivity(current.output),
  };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "--generate" && args.length === 1) {
    const result = await generateV181AdversarialV2(resolve(args[0]));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (command === "--finalize" && args.length === 2) {
    const result = await finalizeV181AdversarialV2(
      resolve(args[0]),
      resolve(args[1]),
    );
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  const result = await verifyV181AdversarialV2();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
