import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { serializeCanonicalJson, sha256Utf8 } from "./canonical-json.mjs";
import { buildV18Baseline } from "./v18-baseline.mjs";

export const V18_GOLDEN_V2_PATH = new URL(
  "../tests/fixtures/v18-original-player-metrics.v2.json",
  import.meta.url,
);

export const V18_GOLDEN_V2_SHA256 =
  "c24421e7afed99ee483930a340e724440d8285a361fa26b2673622de69d5b7b4";

export async function readVerifiedV18GoldenV2() {
  const contents = await readV18GoldenV2();
  const metrics = JSON.parse(contents);
  const canonicalContents = serializeCanonicalJson(metrics);
  if (contents !== canonicalContents) {
    throw new Error("Golden v18: el archivo almacenado no es JSON canónico");
  }
  const goldenSha256 = sha256Utf8(contents);
  if (goldenSha256 !== V18_GOLDEN_V2_SHA256) {
    throw new Error(
      `Golden v18: SHA inesperado (${goldenSha256}); esperado ${V18_GOLDEN_V2_SHA256}`,
    );
  }
  return {
    contents,
    goldenSha256,
    metrics,
  };
}

export const readV18GoldenV2 = () => readFile(V18_GOLDEN_V2_PATH, "utf8");

async function main() {
  if (process.argv.includes("--write")) {
    throw new Error("Golden v18: escritura deshabilitada; el oráculo histórico es inmutable");
  }
  const [result, baseline] = await Promise.all([
    readVerifiedV18GoldenV2(),
    buildV18Baseline(),
  ]);
  if (process.argv.includes("--print-hash")) {
    process.stdout.write(`${result.goldenSha256}\n`);
    return;
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        datasetSha256: baseline.datasetSha256,
        goldenPath: fileURLToPath(V18_GOLDEN_V2_PATH),
        goldenSha256: result.goldenSha256,
        metrics: result.metrics.length,
        written: false,
      },
      null,
      2,
    )}\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
