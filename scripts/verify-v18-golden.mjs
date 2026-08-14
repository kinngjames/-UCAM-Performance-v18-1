import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { sha256Utf8 } from "./canonical-json.mjs";
import {
  generateV18GoldenV2,
  readV18GoldenV2,
  V18_GOLDEN_V2_SHA256,
} from "./v18-golden.mjs";

const cleanHashCommand = fileURLToPath(
  new URL("./v18-golden.mjs", import.meta.url),
);

export async function verifyV18GoldenDeterminism({ alternateNode }) {
  const runA = await generateV18GoldenV2();
  const runB = await generateV18GoldenV2();
  const hashC = execFileSync(alternateNode, [cleanHashCommand, "--print-hash"], {
    encoding: "utf8",
    env: { ...process.env, LANG: "C", LC_ALL: "C" },
  }).trim();
  const fileContents = await readV18GoldenV2();
  const fileHash = sha256Utf8(fileContents);

  assert.equal(runA.goldenSha256, runB.goldenSha256);
  assert.equal(runA.goldenSha256, hashC);
  assert.equal(runA.goldenSha256, fileHash);
  assert.equal(runA.contents, fileContents);
  assert.equal(runA.goldenSha256, V18_GOLDEN_V2_SHA256);

  return {
    datasetSha256: runA.datasetSha256,
    goldenShaA: runA.goldenSha256,
    goldenShaB: runB.goldenSha256,
    goldenShaC: hashC,
    goldenFileSha: fileHash,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const optionIndex = process.argv.indexOf("--alternate-node");
  if (optionIndex === -1 || !process.argv[optionIndex + 1]) {
    throw new Error("Falta --alternate-node con una versión distinta de Node");
  }
  process.stdout.write(
    `${JSON.stringify(
      await verifyV18GoldenDeterminism({
        alternateNode: process.argv[optionIndex + 1],
      }),
      null,
      2,
    )}\n`,
  );
}
