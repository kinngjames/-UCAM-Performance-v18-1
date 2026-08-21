import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const runtimeSource = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "");

test("la plantilla persistente es la única fuente de jugadores en runtime", async () => {
  const [page, buildMetrics] = await Promise.all([
    read("../app/page.tsx").then(runtimeSource),
    read("../domain/metrics/build-metrics.ts"),
  ]);
  assert.doesNotMatch(page, /INITIAL_PLAYERS|INITIAL_ROSTER|POSITION_GROUPS/);
  assert.match(page, /useState<RosterPlayer\[\]>\(\[\]\)/);
  assert.match(
    page,
    /buildMetrics\(\{\s*calendar: CALENDAR,\s*players: activeRoster,/,
  );
  assert.match(
    page,
    /buildMetrics\(\{\s*calendar: CALENDAR,\s*players: roster,/,
  );
  assert.doesNotMatch(page, /function buildMetrics/);
  assert.equal(
    (buildMetrics.match(/export function buildMetrics/g) ?? []).length,
    1,
  );
  assert.match(page, /nextRoster\.flatMap/);
  assert.match(page, /players=\{activeRoster\}/);
});

test("Equipo concentra estado y gestión sin una entrada Plantilla", async () => {
  const page = runtimeSource(await read("../app/page.tsx"));
  const nav = page.slice(page.indexOf("const STAFF_NAV"), page.indexOf("const PLAYER_NAV"));
  assert.doesNotMatch(nav, /players|Plantilla/);
  assert.match(nav, /Hoy/);
  assert.match(nav, /Equipo/);
  assert.match(nav, /Sesiones/);
  assert.match(nav, /Carga/);
  assert.match(nav, /Informes/);
  assert.match(page, /function TeamWorkspace/);
  assert.match(page, /Gestionar plantilla/);
});

test("la navegación contextual comparte filtros y conserva estados operativos", async () => {
  const page = runtimeSource(await read("../app/page.tsx"));
  assert.ok((page.match(/ucam-team-v18/g) ?? []).length >= 3);
  assert.match(page, /playerReturnRef/);
  assert.match(page, /view=\{sessionView\}/);
  assert.match(page, /playerOrder=\{loadOrder\}/);
  assert.match(page, /historyIndex=\{loadHistoryIndex\}/);
  assert.match(page, /STAFF_MOBILE_NAV/);
  assert.match(page, /staff-bottom-nav/);
});

test("los controles visibles tienen persistencia real y protegen cambios", async () => {
  const page = runtimeSource(await read("../app/page.tsx"));
  for (const fakeLabel of [
    "Guardar partido",
    "Guardar bienestar",
    "Aplicar umbrales",
    "+ Añadir nota",
    "Ver semana",
  ]) assert.doesNotMatch(page, new RegExp(fakeLabel.replace("+", "\\+")));
  assert.match(page, /Hay cambios sin guardar/);
  assert.match(page, /El dorsal \$\{number\} ya pertenece/);
  assert.match(page, /REGENERATE_PIN/);
  assert.match(page, /DISABLE_ACCESS/);
  assert.match(page, /ARCHIVE/);
  assert.match(page, /ACTIVATE/);
});

test("vacío no se convierte en cero y el partido conserva minutos desconocidos", async () => {
  const [page, schema, stateApi, dataApi] = await Promise.all([
    read("../app/page.tsx"),
    read("../db/schema.ts"),
    read("../app/api/state/route.ts"),
    read("../app/api/data/route.ts"),
  ]);
  assert.match(page, /event\.target\.value === ""\s*\? null/);
  assert.match(page, /minutes: row\?\.minutes == null \? null/);
  assert.match(schema, /minutesRecorded/);
  assert.match(stateApi, /minutesRecorded = minutes == null \? 0 : 1/);
  assert.match(dataApi, /CASE WHEN mp\.minutes_recorded=1 THEN mp\.minutes ELSE NULL END/);
});

test("C10 valida thresholds en escritura y normaliza legacy en lectura", async () => {
  const [page, stateApi, dataApi] = await Promise.all([
    read("../app/page.tsx"),
    read("../app/api/state/route.ts"),
    read("../app/api/data/route.ts"),
  ]);
  assert.match(stateApi, /rows\.map\(validateThresholdRecordForWrite\)/);
  assert.match(dataApi, /normalizePersistedThresholdRows/);
  assert.match(dataApi, /thresholdNormalizations/);
  assert.match(page, /parseThresholdValue/);
  assert.match(page, /if \(parsed == null\) return/);
});

test("archivar preserva histórico y retira acceso activo", async () => {
  const api = await read("../app/api/admin/players/route.ts");
  assert.match(api, /SET active=0,access_active=0,archived_at=CURRENT_TIMESTAMP/);
  assert.doesNotMatch(api, /DELETE FROM players/);
  assert.match(api, /SET active=1,archived_at=NULL/);
});

test("C1 mantiene el bienestar opcional accesible y persiste registros nuevos", async () => {
  const page = runtimeSource(await read("../app/page.tsx"));
  assert.match(page, /title: "BIENESTAR OPCIONAL"/);
  assert.match(page, /text: "Bienestar opcional esta semana"/);
  assert.match(page, /target: "wellbeing" as const/);
  assert.match(page, /: \[\.\.\.current, form\]/);
  assert.doesNotMatch(page, /\bcompliance\b/);
  assert.doesNotMatch(page, /\bstreak\b/);
});

test("C6 separa monitorización deportiva y completitud administrativa", async () => {
  const [page, signals, types] = await Promise.all([
    read("../app/page.tsx").then(runtimeSource),
    read("../domain/metrics/signals.ts"),
    read("../domain/metrics/types.ts"),
  ]);
  assert.doesNotMatch(page, /INCOMPLETO|SIN DATOS|Registro incompleto/);
  assert.doesNotMatch(signals, /key:\s*"pending"|Registro incompleto|"info"/);
  assert.doesNotMatch(types, /"INCOMPLETO"|"SIN DATOS"|"info"/);
  assert.match(types, /export type Status = MonitoringStatus \| null/);
  assert.match(types, /export type RecordCompleteness/);
  assert.match(page, /Calidad de registro/);
  assert.match(page, /recordCompletenessText/);
});
