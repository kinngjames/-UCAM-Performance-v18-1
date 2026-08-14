import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { withCurrentMetricsEngine } from "../scripts/metrics-characterization.mjs";

test("status null se renderiza como raya neutra y nunca como OK", async () => {
  const { emptyHtml, okHtml } = await withCurrentMetricsEngine(
    ({ monitoringStatus }) => ({
      emptyHtml: renderToStaticMarkup(
        createElement(monitoringStatus.StatusBadge, { status: null }),
      ),
      okHtml: renderToStaticMarkup(
        createElement(monitoringStatus.StatusBadge, { status: "OK" }),
      ),
    }),
  );
  assert.equal(
    emptyHtml,
    '<span class="monitoring-empty" aria-label="Monitorización sin estado">—</span>',
  );
  assert.doesNotMatch(emptyHtml, /status-ok|badge|✓|check|verde/i);
  assert.match(okHtml, /class="status status-ok"/);
  assert.match(okHtml, /✓/);
});
