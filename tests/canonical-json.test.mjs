import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalizeJson,
  serializeCanonicalJson,
  sha256Utf8,
} from "../scripts/canonical-json.mjs";

test("ordena objetos y preserva arrays, null, UTF-8, indentación y LF", () => {
  const input = {
    zeta: [{ z: 3, a: "á" }, null],
    alpha: { delta: 4, beta: 2 },
  };
  const expected = [
    "{",
    '  "alpha": {',
    '    "beta": 2,',
    '    "delta": 4',
    "  },",
    '  "zeta": [',
    "    {",
    '      "a": "á",',
    '      "z": 3',
    "    },",
    "    null",
    "  ]",
    "}",
    "",
  ].join("\n");

  assert.equal(serializeCanonicalJson(input), expected);
  assert.deepEqual(Object.keys(canonicalizeJson(input)), ["alpha", "zeta"]);
  assert.equal(sha256Utf8(expected), sha256Utf8(serializeCanonicalJson(input)));
});

test("rechaza undefined, números no finitos y colecciones sin orden explícito", () => {
  assert.throws(() => serializeCanonicalJson({ value: undefined }), /undefined/);
  assert.throws(() => serializeCanonicalJson([undefined]), /undefined/);
  assert.throws(() => serializeCanonicalJson({ value: Number.NaN }), /no finito/);
  assert.throws(() => serializeCanonicalJson(new Map()), /no plano/);
  assert.throws(() => serializeCanonicalJson(new Set()), /no plano/);
  assert.notEqual(
    sha256Utf8(serializeCanonicalJson({ ratio: null })),
    sha256Utf8(serializeCanonicalJson({})),
  );
  assert.match(serializeCanonicalJson({ precise: 1.23456789 }), /1\.23456789/);
});
