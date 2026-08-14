import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { serializeCanonicalJson, sha256Utf8 } from "./canonical-json.mjs";
import { withCurrentMetricsEngine } from "./metrics-characterization.mjs";
import { V18_DATASET_SHA256 } from "./v18-baseline.mjs";

export const V18_ADVERSARIAL_INPUT_PATH = new URL(
  "../tests/fixtures/v18-adversarial-input.json",
  import.meta.url,
);
export const V18_ADVERSARIAL_OUTPUT_PATH = new URL(
  "../tests/fixtures/v18-adversarial-output.json",
  import.meta.url,
);

export const V18_ADVERSARIAL_INPUT_SHA256 =
  "00fb9f767a9155d637ef5b68154d4f663db3b67a7f01e0a0442263b5ee76e23b";
export const V18_ADVERSARIAL_OUTPUT_SHA256 =
  "aa5090b824c00635966fb42edc77f8fe544b093bf278ba8e4210ba4353d5bd6d";

const assertPinnedSha = (label, actual, expected) => {
  if (actual !== expected) {
    throw new Error(
      `Fixture adversarial: SHA ${label} inesperado (${actual}); esperado ${expected}`,
    );
  }
};

const player = (id, name, number) => ({
  accessActive: true,
  active: true,
  birthDate: "2009-01-01",
  dominantFoot: "DERECHA",
  id,
  name,
  notes: "Fixture adversarial v18",
  number,
  position: "MEDIO",
});

const session = ({ attendance = "ENTRENÓ", minutes, playerId, rpe, session, weekId }) => ({
  attendance,
  incident: "",
  key: `ADV-${weekId}-S${session}-${playerId}`,
  minutes,
  note: "",
  playerId,
  rpe,
  session,
  weekId,
});

const completeWellbeing = (playerId, weekId) => ({
  fatigue: 2,
  mood: 4,
  notes: "",
  pain: 0,
  playerId,
  sleep: 8,
  stress: 2,
  weekId,
});

const availability = (playerId, weekId, value = "COMPLETO") => ({
  note: value === "NO DISPONIBLE" ? "Lesionado; sin exposición" : "Fixture adversarial",
  playerId,
  value,
  weekId,
});

const plan = (weekId, sessionNumber) => ({
  closed: true,
  date: `2026-09-${20 + sessionNumber}`,
  key: `${weekId}-${sessionNumber}`,
  md: `S${sessionNumber}`,
  name: `Sesión planificada ${sessionNumber}`,
  notes: "Plan de cuatro sesiones",
  plannedDuration: 60,
  session: sessionNumber,
  targetRpe: 5,
  time: "18:00",
  type: "Campo",
  weekId,
});

const stableRpeHistory = [6, 6.3, 6, 6.3, 6];
const edgeRpeHistory = [6, 6.3, 6, 6.3];

const buildInput = ({ calendarSha256, thresholds }) => {
  const stableId = "ADV-STABLE";
  const edgeId = "ADV-EDGE";
  const stableSessions = stableRpeHistory.map((rpe, index) =>
    session({
      minutes: 60,
      playerId: stableId,
      rpe,
      session: 1,
      weekId: index + 1,
    }),
  );
  for (let sessionNumber = 1; sessionNumber <= 4; sessionNumber += 1) {
    stableSessions.push(
      session({
        minutes: 60,
        playerId: stableId,
        rpe: 6.5,
        session: sessionNumber,
        weekId: 6,
      }),
    );
  }

  const edgeSessions = edgeRpeHistory.map((rpe, index) =>
    session({
      minutes: 1000 / rpe,
      playerId: edgeId,
      rpe,
      session: 1,
      weekId: index + 1,
    }),
  );
  edgeSessions.push(
    session({
      minutes: 980 / 6,
      playerId: edgeId,
      rpe: 6,
      session: 1,
      weekId: 5,
    }),
    session({
      minutes: 60,
      playerId: edgeId,
      rpe: null,
      session: 2,
      weekId: 5,
    }),
  );
  for (let sessionNumber = 1; sessionNumber <= 4; sessionNumber += 1) {
    edgeSessions.push(
      session({
        attendance: "LESIONADO",
        minutes: null,
        playerId: edgeId,
        rpe: null,
        session: sessionNumber,
        weekId: 6,
      }),
    );
  }
  for (let sessionNumber = 1; sessionNumber <= 4; sessionNumber += 1) {
    const trained = sessionNumber <= 2;
    edgeSessions.push(
      session({
        attendance: trained ? "ENTRENÓ" : "AUSENTE",
        minutes: trained ? 60 : null,
        playerId: edgeId,
        rpe: trained ? 6.3 : null,
        session: sessionNumber,
        weekId: 7,
      }),
    );
  }
  edgeSessions.push(
    session({
      minutes: 60,
      playerId: edgeId,
      rpe: 6.5,
      session: 1,
      weekId: 8,
    }),
  );

  return {
    availability: [
      ...Array.from({ length: 6 }, (_, index) => availability(stableId, index + 1)),
      ...Array.from({ length: 8 }, (_, index) =>
        availability(
          edgeId,
          index + 1,
          index + 1 === 6 ? "NO DISPONIBLE" : "COMPLETO",
        ),
      ),
    ],
    baseDatasetSha256: V18_DATASET_SHA256,
    calendarSha256,
    caseMetricKeys: {
      C1: `6-${edgeId}`,
      C2: `7-${edgeId}`,
      C3: `5-${edgeId}`,
      C4: `6-${stableId}`,
      C5: `6-${stableId}`,
      C6: `8-${edgeId}`,
    },
    matches: [
      {
        compensatory: true,
        compensatoryMinutes: 30,
        compensatoryRpe: 5,
        convocation: "NO CONVOCADO",
        date: "2026-09-19",
        key: `6-${stableId}`,
        minutes: 0,
        observation: "Sin minutos; trabajo compensatorio",
        opponent: "Fixture adversarial",
        playerId: stableId,
        rpe: null,
        venue: "LOCAL",
        weekId: 6,
      },
    ],
    plans: [1, 2, 3, 4].map((sessionNumber) => plan(7, sessionNumber)),
    players: [
      player(stableId, "ADVERSARIAL ESTABLE", 91),
      player(edgeId, "ADVERSARIAL CASOS", 92),
    ],
    selectedMetricKeys: [
      ...Array.from({ length: 6 }, (_, index) => `${index + 1}-${stableId}`),
      ...Array.from({ length: 4 }, (_, index) => `${index + 5}-${edgeId}`),
    ],
    sessions: [...stableSessions, ...edgeSessions],
    thresholds,
    wellbeing: [
      ...Array.from({ length: 6 }, (_, index) =>
        completeWellbeing(stableId, index + 1),
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        completeWellbeing(edgeId, index + 1),
      ),
      completeWellbeing(edgeId, 7),
      { ...completeWellbeing(edgeId, 8), stress: null },
    ],
  };
};

const executeInput = (input, { buildMetrics, data }) => {
  if (input.baseDatasetSha256 !== V18_DATASET_SHA256) {
    throw new Error("Fixture adversarial: dataset base inesperado");
  }
  const actualCalendarSha256 = sha256Utf8(serializeCanonicalJson(data.CALENDAR));
  if (actualCalendarSha256 !== input.calendarSha256) {
    throw new Error(
      `Fixture adversarial: CALENDAR cambió (${actualCalendarSha256})`,
    );
  }
  const metricMap = buildMetrics(
    input.players,
    input.sessions,
    input.wellbeing,
    input.plans,
    input.matches,
    input.availability,
    input.thresholds,
  );
  return input.selectedMetricKeys.map((key) => {
    const metric = metricMap.get(key);
    if (!metric) throw new Error(`Fixture adversarial: falta ${key}`);
    return metric;
  });
};

export const readV18AdversarialInput = () =>
  readFile(V18_ADVERSARIAL_INPUT_PATH, "utf8");
export const readV18AdversarialOutput = () =>
  readFile(V18_ADVERSARIAL_OUTPUT_PATH, "utf8");

export async function generateV18AdversarialFixture() {
  const inputContents = await readV18AdversarialInput();
  const input = JSON.parse(inputContents);
  return withCurrentMetricsEngine(({ buildMetrics, data }) => {
    const output = executeInput(input, { buildMetrics, data });
    const outputContents = serializeCanonicalJson(output);
    const inputSha256 = sha256Utf8(serializeCanonicalJson(input));
    const outputSha256 = sha256Utf8(outputContents);
    assertPinnedSha("input", inputSha256, V18_ADVERSARIAL_INPUT_SHA256);
    assertPinnedSha("output", outputSha256, V18_ADVERSARIAL_OUTPUT_SHA256);
    return {
      input,
      inputContents: serializeCanonicalJson(input),
      inputSha256,
      output,
      outputContents,
      outputSha256,
    };
  });
}

async function writeInitialFixtures() {
  return withCurrentMetricsEngine(async ({ buildMetrics, data }) => {
    const calendarSha256 = sha256Utf8(serializeCanonicalJson(data.CALENDAR));
    const input = buildInput({
      calendarSha256,
      thresholds: data.INITIAL_THRESHOLDS,
    });
    const output = executeInput(input, { buildMetrics, data });
    const inputContents = serializeCanonicalJson(input);
    const outputContents = serializeCanonicalJson(output);
    await mkdir(new URL("../tests/fixtures/", import.meta.url), {
      recursive: true,
    });
    await writeFile(V18_ADVERSARIAL_INPUT_PATH, inputContents, {
      encoding: "utf8",
      flag: "wx",
    });
    await writeFile(V18_ADVERSARIAL_OUTPUT_PATH, outputContents, {
      encoding: "utf8",
      flag: "wx",
    });
    const inputSha256 = sha256Utf8(inputContents);
    const outputSha256 = sha256Utf8(outputContents);
    assertPinnedSha("input", inputSha256, V18_ADVERSARIAL_INPUT_SHA256);
    assertPinnedSha("output", outputSha256, V18_ADVERSARIAL_OUTPUT_SHA256);
    return {
      inputSha256,
      outputSha256,
    };
  });
}

async function main() {
  const result = process.argv.includes("--write")
    ? await writeInitialFixtures()
    : await generateV18AdversarialFixture();
  process.stdout.write(
    `${JSON.stringify(
      {
        inputSha256: result.inputSha256,
        outputSha256: result.outputSha256,
      },
      null,
      2,
    )}\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
