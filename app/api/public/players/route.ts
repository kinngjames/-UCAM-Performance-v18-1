import {
  apiError,
  ensureSeeded,
  TEAM_ID,
} from "../../../../lib/server/platform";

export async function GET() {
  try {
    const db = await ensureSeeded();
    const rows = await db
      .prepare(
        "SELECT id, display_name, shirt_number, position FROM players WHERE team_id=? AND active=1 AND access_active=1 ORDER BY shirt_number",
      )
      .bind(TEAM_ID)
      .all();
    return Response.json({ players: rows.results, dataMode: "DEMO" });
  } catch (error) {
    return apiError(error);
  }
}
