import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const runtimeSource = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "");

test("la plantilla persistente es la única fuente de jugadores en runtime", async () => {
  const page = runtimeSource(await read("../app/page.tsx"));
  assert.doesNotMatch(page, /INITIAL_PLAYERS|INITIAL_ROSTER|POSITION_GROUPS/);
  assert.match(page, /useState<RosterPlayer\[\]>\(\[\]\)/);
  assert.match(page, /buildMetrics\(\s*activeRoster/);
  assert.match(page, /buildMetrics\(roster,/);
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

test("archivar preserva histórico y retira acceso activo", async () => {
  const api = await read("../app/api/admin/players/route.ts");
  assert.match(api, /SET active=0,access_active=0,archived_at=CURRENT_TIMESTAMP/);
  assert.doesNotMatch(api, /DELETE FROM players/);
  assert.match(api, /SET active=1,archived_at=NULL/);
});
