import assert from "node:assert/strict";
import { open, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { serializeCanonicalJson, sha256Utf8 } from "./canonical-json.mjs";
import { withCurrentMetricsEngine } from "./metrics-characterization.mjs";

export const V181_ADVERSARIAL_V3_INPUT_PATH = new URL(
  "../tests/fixtures/v18.1-adversarial-v3-input.json",
  import.meta.url,
);
export const V181_ADVERSARIAL_V3_HISTORICAL_OUTPUT_PATH = new URL(
  "../tests/fixtures/v18.1-adversarial-v3-output.json",
  import.meta.url,
);
export const V181_ADVERSARIAL_V3_M3_OUTPUT_PATH = new URL(
  "../tests/fixtures/v18.1-adversarial-v3-m3-output.json",
  import.meta.url,
);
export const V181_ADVERSARIAL_V3_C13_OUTPUT_PATH = new URL(
  "../tests/fixtures/v18.1-adversarial-v3-c13-output.json",
  import.meta.url,
);
export const V181_ADVERSARIAL_V3_C12_OUTPUT_PATH = new URL(
  "../tests/fixtures/v18.1-adversarial-v3-c12-output.json",
  import.meta.url,
);
export const V181_ADVERSARIAL_V3_OUTPUT_PATH = new URL(
  "../tests/fixtures/v18.1-adversarial-v3-final-output.json",
  import.meta.url,
);
export const V181_ADVERSARIAL_V3_MANIFEST_PATH = new URL(
  "../tests/fixtures/v18.1-adversarial-v3-final.manifest.json",
  import.meta.url,
);
export const V181_ADVERSARIAL_V3_INPUT_SHA256 =
  "95b8fbe772bbd42ec12f33120e12c347871baa5bc2611cfc575a207e9ebdd6ec";
export const V181_ADVERSARIAL_V3_HISTORICAL_OUTPUT_SHA256 =
  "98b252d32e9c933d4942f66ca00d4b4af76ad3ad203c0696be70a85108c971d3";
export const V181_ADVERSARIAL_V3_M3_OUTPUT_SHA256 =
  "43b4ed2cab8f0811f344db62e9cfb487067da456e8988626b00612579948cc55";
export const V181_ADVERSARIAL_V3_C13_OUTPUT_SHA256 =
  "0e5994971878f45042f398e832111daadbc877d5a3cd057929a4736438a93a7e";
export const V181_ADVERSARIAL_V3_C12_OUTPUT_SHA256 =
  "70e3f268283deb102350b35a16128eeff08296fc0ec7227dc32ebd0d58c7cd0f";
export const V181_ADVERSARIAL_V3_OUTPUT_SHA256 =
  V181_ADVERSARIAL_V3_C12_OUTPUT_SHA256;

const thresholds = (overrides = {}) => ({
  baselineWeeks: 12,
  criticalSleep: 6.5,
  highFatigue: 4,
  highRpe: 10,
  highStress: 4,
  lowMood: 2,
  lowSleep: 8,
  relevantPain: 4,
  zScore: 1.5,
  ...overrides,
});

const player = (id, number) => ({
  accessActive: true,
  active: true,
  birthDate: "2009-01-01",
  dominantFoot: "DERECHA",
  id,
  name: id,
  notes: "Fixture adversarial v18.1 v3",
  number,
  position: "MEDIO",
});

const availability = (playerId) => ({
  note: "Fixture v3",
  playerId,
  value: "COMPLETO",
  weekId: 1,
});

const wellbeing = (playerId, overrides = {}) => ({
  fatigue: 2,
  mood: 4,
  notes: "Fixture v3",
  pain: 0,
  playerId,
  sleep: 8,
  stress: 2,
  weekId: 1,
  ...overrides,
});

const training = (playerId) => ({
  attendance: "ENTRENÓ",
  incident: "",
  key: `V3-S1-${playerId}`,
  minutes: 60,
  note: "",
  playerId,
  rpe: 5,
  session: 1,
  weekId: 1,
});

const match = (playerId, overrides) => ({
  compensatory: false,
  compensatoryMinutes: 0,
  compensatoryRpe: null,
  convocation: "TITULAR",
  date: "2026-09-20",
  key: `V3-MATCH-${playerId}`,
  minutes: 60,
  observation: "Fixture v3",
  opponent: "ADVERSARIAL",
  playerId,
  rpe: 6,
  venue: "LOCAL",
  weekId: 1,
  ...overrides,
});

export const buildV181AdversarialV3Input = () => {
  const missing = player("V3-T2-MISSING", 94);
  const below = player("V3-T2-BELOW", 95);
  const above = player("V3-T2-ABOVE", 96);
  const effortPlayers = ["M1", "M2", "M3", "M4"].map((id, index) =>
    player(`V3-${id}`, 97 + index),
  );
  return {
    scenarios: [
      {
        caseIds: ["T2-MISSING"],
        input: {
          availability: [availability(missing.id)],
          calendar: [{ id: 1 }],
          matches: [],
          players: [missing],
          sessions: [],
          thresholds: thresholds({ highFatigue: 0, relevantPain: 0 }),
          wellbeing: [
            wellbeing(missing.id, { fatigue: null, pain: null }),
          ],
        },
        metricKeys: [`1-${missing.id}`],
      },
      {
        caseIds: ["T2-BELOW", "T2-ABOVE"],
        input: {
          availability: [availability(below.id), availability(above.id)],
          calendar: [{ id: 1 }],
          matches: [],
          players: [below, above],
          sessions: [],
          thresholds: thresholds(),
          wellbeing: [
            wellbeing(below.id, { fatigue: 3, pain: 3 }),
            wellbeing(above.id, { fatigue: 5, pain: 5 }),
          ],
        },
        metricKeys: [`1-${below.id}`, `1-${above.id}`],
      },
      {
        caseIds: ["M1", "M2", "M3", "M4"],
        input: {
          availability: effortPlayers.map(({ id }) => availability(id)),
          calendar: [{ id: 1 }],
          matches: [
            match("V3-M1", { minutes: null, rpe: 6 }),
            match("V3-M2", { minutes: 60, rpe: null }),
            match("V3-M3", {
              compensatory: true,
              compensatoryMinutes: null,
              compensatoryRpe: 5,
              convocation: "NO CONVOCADO",
              minutes: 0,
              rpe: null,
            }),
            match("V3-M4", {
              compensatory: true,
              compensatoryMinutes: 30,
              compensatoryRpe: null,
              convocation: "NO CONVOCADO",
              minutes: 0,
              rpe: null,
            }),
          ],
          players: effortPlayers,
          sessions: effortPlayers.map(({ id }) => training(id)),
          thresholds: thresholds(),
          wellbeing: effortPlayers.map(({ id }) => wellbeing(id)),
        },
        metricKeys: effortPlayers.map(({ id }) => `1-${id}`),
      },
    ],
    version: "v18.1-adversarial-v3",
  };
};

const runWithBuildMetrics = (input, buildMetrics) =>
  input.scenarios.flatMap((scenario) => {
    const metrics = buildMetrics(scenario.input);
    return scenario.metricKeys.map((key, index) => {
      const metric = metrics.get(key);
      assert.ok(metric, `Fixture v3: falta ${key}`);
      return { caseId: scenario.caseIds[index], metric };
    });
  });

const readVerifiedInput = async () => {
  const contents = await readFile(V181_ADVERSARIAL_V3_INPUT_PATH, "utf8");
  assert.equal(contents, serializeCanonicalJson(JSON.parse(contents)));
  assert.equal(sha256Utf8(contents), V181_ADVERSARIAL_V3_INPUT_SHA256);
  return { contents, input: JSON.parse(contents) };
};

const runCurrent = async (input) =>
  withCurrentMetricsEngine(({ buildMetrics }) =>
    runWithBuildMetrics(input, buildMetrics),
  );

const runC9Mutant = async (input) => {
  const server = await createServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    plugins: [
      {
        enforce: "pre",
        name: "v18.1-v3-c9-mutant",
        transform(code, id) {
          if (!id.endsWith("/domain/metrics/signals.ts")) return null;
          const fatigue =
            /weekly\?\.fatigue != null\s*&&\s*weekly\.fatigue >= thresholds\.highFatigue/;
          const pain =
            /weekly\?\.pain != null\s*&&\s*weekly\.pain >= thresholds\.relevantPain/;
          assert.match(code, fatigue);
          assert.match(code, pain);
          return code
            .replace(
              fatigue,
              "(weekly?.fatigue ?? 0) >= thresholds.highFatigue",
            )
            .replace(
              pain,
              "(weekly?.pain ?? 0) >= thresholds.relevantPain",
            );
        },
      },
    ],
    root: new URL("../", import.meta.url).pathname,
    server: { middlewareMode: true },
  });
  try {
    const domain = await server.ssrLoadModule("/domain/metrics/index.ts");
    return runWithBuildMetrics(input, domain.buildMetrics);
  } finally {
    await server.close();
  }
};

export async function proveV181AdversarialV3Sensitivity() {
  const { input } = await readVerifiedInput();
  const [correct, mutant] = await Promise.all([
    runCurrent(input),
    runC9Mutant(input),
  ]);
  assert.notEqual(serializeCanonicalJson(mutant), serializeCanonicalJson(correct));
  const missingCorrect = correct.find(({ caseId }) => caseId === "T2-MISSING");
  const missingMutant = mutant.find(({ caseId }) => caseId === "T2-MISSING");
  assert.deepEqual(missingCorrect.metric.signals, []);
  assert.deepEqual(
    missingMutant.metric.signals.map(({ key }) => key),
    ["fatigue", "pain"],
  );
  return {
    correct: "PASS",
    detectedMutation: "C9: null coaccionado a 0 con threshold=0",
    mutant: "FAIL",
    scope: "mutación esperada; no es cobertura exhaustiva",
  };
}

const writeExclusive = async (path, contents) => {
  const handle = await open(path, "wx");
  try {
    await handle.writeFile(contents, "utf8");
  } finally {
    await handle.close();
  }
};

const finalManifest = () => ({
  cases: ["T2-MISSING", "T2-BELOW", "T2-ABOVE", "M1", "M2", "M3", "M4"],
  contract: [
    "C9-null-guards",
    "M3-compensatory-expectation",
    "C13-null-components-known-total",
    "C12-no-sessions-alias",
  ],
  engine: "domain/metrics/build-metrics.ts#buildMetrics",
  format: "canonical-json-v1",
  inputFilename: basename(fileURLToPath(V181_ADVERSARIAL_V3_INPUT_PATH)),
  inputSha256: V181_ADVERSARIAL_V3_INPUT_SHA256,
  outputFilename: basename(fileURLToPath(V181_ADVERSARIAL_V3_OUTPUT_PATH)),
  outputSha256: V181_ADVERSARIAL_V3_OUTPUT_SHA256,
  records: 7,
  sensitivity: "C9-null-coercion-mutant",
  version: "v18.1-adversarial-v3-final",
});

export async function verifyV181AdversarialV3() {
  const { contents: inputContents, input } = await readVerifiedInput();
  const historical = await readFile(
    V181_ADVERSARIAL_V3_HISTORICAL_OUTPUT_PATH,
    "utf8",
  );
  assert.equal(historical, serializeCanonicalJson(JSON.parse(historical)));
  assert.equal(
    sha256Utf8(historical),
    V181_ADVERSARIAL_V3_HISTORICAL_OUTPUT_SHA256,
  );
  const m3 = await readFile(V181_ADVERSARIAL_V3_M3_OUTPUT_PATH, "utf8");
  assert.equal(m3, serializeCanonicalJson(JSON.parse(m3)));
  assert.equal(sha256Utf8(m3), V181_ADVERSARIAL_V3_M3_OUTPUT_SHA256);
  const c13 = await readFile(V181_ADVERSARIAL_V3_C13_OUTPUT_PATH, "utf8");
  assert.equal(c13, serializeCanonicalJson(JSON.parse(c13)));
  assert.equal(sha256Utf8(c13), V181_ADVERSARIAL_V3_C13_OUTPUT_SHA256);
  const c12 = await readFile(V181_ADVERSARIAL_V3_C12_OUTPUT_PATH, "utf8");
  assert.equal(c12, serializeCanonicalJson(JSON.parse(c12)));
  assert.equal(sha256Utf8(c12), V181_ADVERSARIAL_V3_C12_OUTPUT_SHA256);
  const output = await runCurrent(input);
  const outputContents = serializeCanonicalJson(output);
  const stored = await readFile(V181_ADVERSARIAL_V3_OUTPUT_PATH, "utf8");
  assert.equal(stored, outputContents);
  assert.equal(stored, c12, "T1 no puede alterar el fixture final");
  assert.equal(sha256Utf8(stored), V181_ADVERSARIAL_V3_OUTPUT_SHA256);
  const manifestContents = await readFile(
    V181_ADVERSARIAL_V3_MANIFEST_PATH,
    "utf8",
  );
  assert.equal(manifestContents, serializeCanonicalJson(finalManifest()));
  return {
    inputSha256: sha256Utf8(inputContents),
    output,
    outputSha256: sha256Utf8(outputContents),
    sensitivity: await proveV181AdversarialV3Sensitivity(),
  };
}

export async function generateCurrentV181AdversarialV3(outputPath) {
  const { input } = await readVerifiedInput();
  const outputContents = serializeCanonicalJson(await runCurrent(input));
  await writeExclusive(outputPath, outputContents);
  return { outputSha256: sha256Utf8(outputContents) };
}

export async function finalizeV181AdversarialV3() {
  const { input } = await readVerifiedInput();
  const outputContents = serializeCanonicalJson(await runCurrent(input));
  assert.equal(sha256Utf8(outputContents), V181_ADVERSARIAL_V3_OUTPUT_SHA256);
  await writeExclusive(V181_ADVERSARIAL_V3_OUTPUT_PATH, outputContents);
  await writeExclusive(
    V181_ADVERSARIAL_V3_MANIFEST_PATH,
    serializeCanonicalJson(finalManifest()),
  );
  return {
    inputSha256: V181_ADVERSARIAL_V3_INPUT_SHA256,
    outputSha256: V181_ADVERSARIAL_V3_OUTPUT_SHA256,
  };
}

async function bootstrap(inputPath, outputPath) {
  const inputContents = serializeCanonicalJson(buildV181AdversarialV3Input());
  await writeExclusive(inputPath, inputContents);
  const output = await runCurrent(JSON.parse(inputContents));
  const outputContents = serializeCanonicalJson(output);
  await writeExclusive(outputPath, outputContents);
  return {
    inputSha256: sha256Utf8(inputContents),
    outputSha256: sha256Utf8(outputContents),
  };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "--bootstrap" && args.length === 2) {
    process.stdout.write(
      `${JSON.stringify(await bootstrap(resolve(args[0]), resolve(args[1])))}\n`,
    );
    return;
  }
  if (command === "--generate-output" && args.length === 1) {
    process.stdout.write(
      `${JSON.stringify(
        await generateCurrentV181AdversarialV3(resolve(args[0])),
      )}\n`,
    );
    return;
  }
  if (command === "--finalize" && args.length === 0) {
    process.stdout.write(
      `${JSON.stringify(await finalizeV181AdversarialV3())}\n`,
    );
    return;
  }
  process.stdout.write(`${JSON.stringify(await verifyV181AdversarialV3())}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
