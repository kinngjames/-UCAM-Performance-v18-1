import {
  apiError,
  ensureSeeded,
  requireAuth,
} from "../../../lib/server/platform";

const csv = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, ["STAFF", "ADMIN"]);
    const db = await ensureSeeded();
    const url = new URL(request.url);
    const type = url.searchParams.get("type") ?? "players";
    const week = Number(url.searchParams.get("week") ?? 18);
    let rows: Array<Record<string, unknown>> = [];
    let filename = "ucam-plantilla.csv";
    if (type === "week") {
      const result = await db
        .prepare(
          "SELECT w.label,p.display_name AS jugador,p.shirt_number AS dorsal,ts.session_number AS sesion,sp.attendance_status AS asistencia,sp.actual_minutes AS minutos,sr.rpe,(COALESCE(sr.rpe,0)*COALESCE(sp.actual_minutes,0)) AS carga FROM session_participation sp JOIN training_sessions ts ON ts.id=sp.session_id JOIN weeks w ON w.id=ts.week_id JOIN players p ON p.id=sp.player_id LEFT JOIN session_rpe sr ON sr.session_id=ts.id AND sr.player_id=sp.player_id WHERE w.sequence=? AND w.team_id=? ORDER BY p.shirt_number,ts.session_number",
        )
        .bind(week, auth.teamId)
        .all();
      rows = result.results as Array<Record<string, unknown>>;
      filename = `ucam-jornada-${week}.csv`;
    } else {
      const result = await db
        .prepare(
          "SELECT id,display_name AS nombre,shirt_number AS dorsal,position AS posicion,date_of_birth AS nacimiento,dominant_foot AS pierna,active AS activo FROM players WHERE team_id=? ORDER BY shirt_number",
        )
        .bind(auth.teamId)
        .all();
      rows = result.results as Array<Record<string, unknown>>;
    }
    const keys = rows.length ? Object.keys(rows[0]) : ["sin_datos"];
    const content = [
      keys.map(csv).join(","),
      ...rows.map((row) => keys.map((key) => csv(row[key])).join(",")),
    ].join("\n");
    return new Response(`\uFEFF${content}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
