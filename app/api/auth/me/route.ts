import {
  apiError,
  ensureSeeded,
  resolveAuth,
  SEASON_ID,
} from "../../../../lib/server/platform";

export async function GET(request: Request) {
  try {
    const db = await ensureSeeded();
    const auth = await resolveAuth(request);
    if (!auth) return Response.json({ authenticated: false }, { status: 401 });
    const team = await db
      .prepare(
        "SELECT id, organization_name, name, category, timezone, data_mode FROM teams WHERE id=?",
      )
      .bind(auth.teamId)
      .first();
    const season = await db
      .prepare("SELECT id, name, starts_on, ends_on FROM seasons WHERE id=?")
      .bind(SEASON_ID)
      .first();
    const players =
      auth.role === "PLAYER"
        ? await db
            .prepare(
              "SELECT id, display_name, shirt_number, position, date_of_birth, dominant_foot, active FROM players WHERE id=? AND team_id=?",
            )
            .bind(auth.playerId, auth.teamId)
            .all()
        : await db
            .prepare(
              "SELECT id, display_name, shirt_number, position, date_of_birth, dominant_foot, active FROM players WHERE team_id=? ORDER BY shirt_number",
            )
            .bind(auth.teamId)
            .all();
    const staff =
      auth.role === "ADMIN"
        ? await db
            .prepare(
              "SELECT id, name, email, role, active, invite_status, last_access_at FROM staff_permissions WHERE team_id=? ORDER BY role, name",
            )
            .bind(auth.teamId)
            .all()
        : { results: [] };
    return Response.json({
      authenticated: true,
      auth,
      team,
      season,
      players: players.results,
      staff: staff.results,
    });
  } catch (error) {
    return apiError(error);
  }
}
