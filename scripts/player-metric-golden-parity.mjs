import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import tsModule from "typescript";
import { V181_F2_GOLDEN_PATH } from "./v18.1-f2-golden.mjs";

const ts = tsModule.default ?? tsModule;

export const PLAYER_METRIC_TYPE_PATH = new URL(
  "../domain/metrics/types.ts",
  import.meta.url,
);

export function declaredPlayerMetricFields(source) {
  const sourceFile = ts.createSourceFile(
    "domain/metrics/types.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const declarations = sourceFile.statements.filter(
    (statement) =>
      ts.isTypeAliasDeclaration(statement) &&
      statement.name.text === "PlayerMetric",
  );
  assert.equal(declarations.length, 1, "PlayerMetric debe tener una declaración");
  const declaration = declarations[0];
  assert.ok(
    ts.isTypeLiteralNode(declaration.type),
    "PlayerMetric debe conservar un contrato de propiedades explícitas",
  );
  return declaration.type.members.map((member) => {
    assert.ok(
      ts.isPropertySignature(member) && member.name,
      "PlayerMetric solo puede declarar propiedades nominales",
    );
    if (
      ts.isIdentifier(member.name) ||
      ts.isStringLiteral(member.name) ||
      ts.isNumericLiteral(member.name)
    ) {
      return member.name.text;
    }
    throw new Error("PlayerMetric contiene una propiedad no nominal");
  });
}

export function assertPlayerMetricGoldenParity(declaredFields, metrics) {
  assert.ok(Array.isArray(declaredFields));
  assert.ok(Array.isArray(metrics));
  const expected = [...declaredFields].sort();
  assert.equal(
    new Set(expected).size,
    expected.length,
    "PlayerMetric contiene nombres de campo duplicados",
  );
  for (let index = 0; index < metrics.length; index += 1) {
    assert.deepEqual(
      Object.keys(metrics[index]).sort(),
      expected,
      `PlayerMetric golden[${index}] no coincide con el tipo declarado`,
    );
  }
  return { fields: expected, metrics: metrics.length };
}

export async function verifyPlayerMetricGoldenParity() {
  const [source, goldenContents] = await Promise.all([
    readFile(PLAYER_METRIC_TYPE_PATH, "utf8"),
    readFile(V181_F2_GOLDEN_PATH, "utf8"),
  ]);
  return assertPlayerMetricGoldenParity(
    declaredPlayerMetricFields(source),
    JSON.parse(goldenContents),
  );
}
