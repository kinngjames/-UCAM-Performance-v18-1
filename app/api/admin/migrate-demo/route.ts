import {
  apiError,
  audit,
  ensureSeeded,
  requireAuth,
  seedWeekData,
} from "../../../../lib/server/platform";
import { CALENDAR } from "../../../data";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, ["ADMIN"]);
    const db = await ensureSeeded();
    for (const week of CALENDAR)
      await seedWeekData(db, week.id, "DEMO_MIGRATION");
    await audit(
      auth,
      "MIGRATE_DEMO_SEASON",
      "season",
      "season-2026-27",
      null,
      { weeks: CALENDAR.length },
      request.headers.get("cf-ray"),
    );
    return Response.json({ ok: true, weeks: CALENDAR.length });
  } catch (error) {
    return apiError(error);
  }
}
