import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { withCurrentMetricsEngine } from "../scripts/metrics-characterization.mjs";
import { V18_LOCALE } from "../scripts/v18-baseline.mjs";

test("fija Node y exige el formateador contractual usado por señales", async () => {
  const environmentFailure = (detail) =>
    `ENTORNO: ${detail}; no es un fallo de DOMINIO`;

  assert.equal(
    process.versions.node,
    "24.19.0",
    environmentFailure("versión de Node incompatible"),
  );
  assert.equal(
    process.versions.icu,
    "78.3",
    environmentFailure("versión de ICU incompatible"),
  );
  assert.deepEqual(Intl.NumberFormat.supportedLocalesOf([V18_LOCALE]), [
    V18_LOCALE,
  ], environmentFailure(`locale ${V18_LOCALE} no disponible`));
  assert.equal(
    new Intl.NumberFormat(V18_LOCALE).resolvedOptions().locale,
    V18_LOCALE,
    environmentFailure(`Intl no resuelve el locale ${V18_LOCALE}`),
  );

  await withCurrentMetricsEngine(
    ({ display, formatSignalNumber }) => {
      const assertFormat = (actual, expected, input) =>
        assert.equal(
          actual,
          expected,
          environmentFailure(
            `contrato Intl/formatSignalNumber incompatible para ${input}`,
          ),
        );
      assertFormat(formatSignalNumber(6.5), "6,5", "6.5");
      assertFormat(formatSignalNumber(12345.6), "12.345,6", "12345.6");
      assertFormat(
        formatSignalNumber(12345.6, 2),
        "12.345,60",
        "12345.6/2",
      );
      assertFormat(formatSignalNumber(-0.1), "-0,1", "-0.1");
      assert.equal(
        display(null),
        "—",
        "DOMINIO: la ausencia visual debe quedar fuera del formateador de señales",
      );
    },
  );

  const signalsSource = await readFile(
    new URL("../domain/metrics/signals.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    signalsSource,
    /import \{ formatSignalNumber \} from "\.\/format";/,
    "DOMINIO: signals.ts debe consumir directamente formatSignalNumber",
  );
});
