import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { serializeCanonicalJson, sha256Utf8 } from "./canonical-json.mjs";
import { buildV18Baseline } from "./v18-baseline.mjs";

export const V18_GOLDEN_V2_PATH = new URL(
  "../tests/fixtures/v18-original-player-metrics.v2.json",
  import.meta.url,
);

export const V18_GOLDEN_V2_SHA256 =
  "c24421e7afed99ee483930a340e724440d8285a361fa26b2673622de69d5b7b4";

export async function generateV18GoldenV2() {
  const baseline = await buildV18Baseline();
  const contents = serializeCanonicalJson(baseline.metrics);
  return {
    ...baseline,
    contents,
    goldenSha256: sha256Utf8(contents),
  };
}

export const readV18GoldenV2 = () => readFile(V18_GOLDEN_V2_PATH, "utf8");

async function main() {
  const result = await generateV18GoldenV2();
  if (process.argv.includes("--write")) {
    await mkdir(new URL("../tests/fixtures/", import.meta.url), {
      recursive: true,
    });
    await writeFile(V18_GOLDEN_V2_PATH, result.contents, {
      encoding: "utf8",
      flag: "wx",
    });
  }
  if (process.argv.includes("--print-hash")) {
    process.stdout.write(`${result.goldenSha256}\n`);
    return;
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        datasetSha256: result.datasetSha256,
        goldenPath: fileURLToPath(V18_GOLDEN_V2_PATH),
        goldenSha256: result.goldenSha256,
        metrics: result.metrics.length,
        written: process.argv.includes("--write"),
      },
      null,
      2,
    )}\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
