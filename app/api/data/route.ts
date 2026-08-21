import {
  apiError,
  assertOwnPlayer,
  ensureSeeded,
  requireAuth,
  seedWeekData,
} from "../../../lib/server/platform";
import { normalizePersistedThresholdRows } from "../../../domain/metrics";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const url = new URL(request.url);
    const weekId = Number(url.searchParams.get("week") ?? "18");
    if (!Number.isInteger(weekId) || weekId < 1 || weekId > 200)
      return Response.json(
        { error: "La jornada no es válida." },
        { status: 400 },
      );
    const db = await ensureSeeded();
    const weekKey = `week-${weekId}`;
    const count = await db
      .prepare(
        "SELECT COUNT(*) AS count FROM session_participation sp JOIN training_sessions ts ON ts.id=sp.session_id WHERE ts.week_id=?",
      )
      .bind(weekKey)
      .first<{ count: number }>();
    if ((count?.count ?? 0) === 0)
      await seedWeekData(db, weekId, "DEMO_MIGRATION");
    const playerFilter =
      auth.role === "PLAYER" ? auth.playerId! : url.searchParams.get("player");
    if (playerFilter) assertOwnPlayer(auth, playerFilter);
    const playersSql = `SELECT id,name,display_name,shirt_number,position,date_of_birth,dominant_foot,notes,access_active,active,archived_at FROM players WHERE team_id=?${playerFilter ? " AND active=1 AND id=?" : ""} ORDER BY active DESC,shirt_number,name`;
    const sessionsSql = `SELECT ts.session_number, sp.player_id, sp.attendance_status, sp.actual_minutes, sp.notes, sr.rpe FROM session_participation sp JOIN training_sessions ts ON ts.id=sp.session_id LEFT JOIN session_rpe sr ON sr.session_id=ts.id AND sr.player_id=sp.player_id WHERE ts.week_id=?${playerFilter ? " AND sp.player_id=?" : ""}`;
    const wellnessSql = `SELECT player_id, sleep_hours, mood, fatigue, pain, stress, notes FROM weekly_wellness WHERE week_id=?${playerFilter ? " AND player_id=?" : ""}`;
    const availabilitySql = `SELECT player_id, availability, note FROM player_week_status WHERE week_id=?${playerFilter ? " AND player_id=?" : ""}`;
    const matchesSql = `SELECT mp.player_id, m.rival, m.venue, m.date, mp.squad_status, CASE WHEN mp.minutes_recorded=1 THEN mp.minutes ELSE NULL END AS minutes, mp.minutes_recorded, mp.rpe, mp.observation, mp.compensatory, mp.compensatory_minutes, mp.compensatory_rpe FROM match_participation mp JOIN matches m ON m.id=mp.match_id WHERE m.week_id=?${playerFilter ? " AND mp.player_id=?" : ""}`;
    const painsSql = `SELECT id, player_id, date, body_area, intensity, limitation, observation FROM pain_records WHERE week_id=? AND deleted_at IS NULL${playerFilter ? " AND player_id=?" : ""}`;
    const alertsSql = `SELECT id, player_id, status, note, reason, updated_at FROM alerts WHERE week_id=?${playerFilter ? " AND player_id=?" : ""}`;
    const bind = (sql: string) =>
      playerFilter
        ? db.prepare(sql).bind(weekKey, playerFilter)
        : db.prepare(sql).bind(weekKey);
    const [
      players,
      sessions,
      wellness,
      availability,
      matches,
      pains,
      alerts,
      plans,
      thresholds,
    ] = await Promise.all([
      playerFilter
        ? db.prepare(playersSql).bind(auth.teamId, playerFilter).all()
        : db.prepare(playersSql).bind(auth.teamId).all(),
      bind(sessionsSql).all(),
      bind(wellnessSql).all(),
      bind(availabilitySql).all(),
      bind(matchesSql).all(),
      bind(painsSql).all(),
      bind(alertsSql).all(),
      db
        .prepare(
          "SELECT session_number, session_name, date, time, md_context, session_type, planned_duration, notes, status FROM training_sessions WHERE week_id=? ORDER BY session_number",
        )
        .bind(weekKey)
        .all(),
      db
        .prepare("SELECT key, value FROM thresholds WHERE team_id=?")
        .bind(auth.teamId)
        .all(),
    ]);
    const normalizedThresholds = normalizePersistedThresholdRows(
      thresholds.results as Array<Record<string, unknown>>,
    );
    if (normalizedThresholds.normalizations.length)
      console.warn(
        "THRESHOLD_NORMALIZATION",
        JSON.stringify(normalizedThresholds.normalizations),
      );
    return Response.json({
      weekId,
      players: players.results,
      sessions: sessions.results,
      wellbeing: wellness.results,
      availability: availability.results,
      matches: matches.results,
      painRecords: pains.results,
      alerts: alerts.results,
      plans: plans.results,
      thresholds: normalizedThresholds.rows,
      thresholdNormalizations: normalizedThresholds.normalizations,
    });
  } catch (error) {
    return apiError(error);
  }
}
