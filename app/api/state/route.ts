import {
  ApiError,
  apiError,
  assertOwnPlayer,
  audit,
  ensureSeeded,
  requireAuth,
  SEASON_ID,
} from "../../../lib/server/platform";
import { validateThresholdRecordForWrite } from "../../../domain/metrics";
import type { Thresholds } from "../../../domain/metrics";

type Domain =
  | "sessions"
  | "wellbeing"
  | "availability"
  | "matches"
  | "painRecords"
  | "alerts"
  | "plans"
  | "thresholds";
const num = (value: unknown, min: number, max: number, nullable = false) => {
  if (nullable && (value === null || value === "" || value === undefined))
    return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max)
    throw new ApiError(
      400,
      "Uno de los valores está fuera del rango permitido.",
    );
  return parsed;
};

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    const body = (await request.json()) as {
      domain?: Domain;
      weekId?: number;
      rows?: Array<Record<string, unknown>>;
    };
    const domain = body.domain;
    const weekId = Number(body.weekId);
    const rows = body.rows ?? [];
    if (!domain || !Number.isInteger(weekId) || !Array.isArray(rows))
      throw new ApiError(400, "Los datos enviados no son válidos.");
    if (rows.length > 120)
      throw new ApiError(413, "Demasiados registros en una sola operación.");
    if (
      auth.role === "PLAYER" &&
      !["sessions", "wellbeing", "painRecords", "matches"].includes(domain)
    )
      throw new ApiError(403, "No tienes permisos para modificar estos datos.");
    let validatedThresholdRows: Array<
      Partial<Record<keyof Thresholds, number>>
    > | null = null;
    if (domain === "thresholds") {
      if (auth.role !== "ADMIN")
        throw new ApiError(
          403,
          "Solo un administrador puede modificar los umbrales.",
        );
      try {
        validatedThresholdRows = rows.map(validateThresholdRecordForWrite);
      } catch {
        throw new ApiError(
          400,
          "Uno de los umbrales no es válido; se conserva la configuración anterior.",
        );
      }
    }
    const db = await ensureSeeded();
    const now = new Date().toISOString();
    const weekKey = `week-${weekId}`;
    for (const [rowIndex, row] of rows.entries()) {
      const playerId = row.playerId ? String(row.playerId) : null;
      if (playerId) assertOwnPlayer(auth, playerId);
      if (domain === "sessions") {
        if (!playerId) continue;
        const session = Number(row.session);
        const sessionId = `session-${weekId}-${session}`;
        const attendance = String(row.attendance);
        if (
          !["ENTRENÓ", "DESCANSO", "LESIONADO", "AUSENTE"].includes(attendance)
        )
          throw new ApiError(400, "La asistencia no es válida.");
        const minutes = num(row.minutes, 0, 240, true);
        const rpe = num(row.rpe, 0, 10, true);
        const before = await db
          .prepare(
            "SELECT sp.attendance_status,sp.actual_minutes,sr.rpe FROM session_participation sp LEFT JOIN session_rpe sr ON sr.session_id=sp.session_id AND sr.player_id=sp.player_id WHERE sp.session_id=? AND sp.player_id=?",
          )
          .bind(sessionId, playerId)
          .first<Record<string, unknown>>();
        if (auth.role === "PLAYER") {
          const window = await db
            .prepare(
              "SELECT status FROM training_sessions WHERE id=? AND team_id=?",
            )
            .bind(sessionId, auth.teamId)
            .first<{ status: string }>();
          const unchanged =
            before &&
            String(before.attendance_status) === attendance &&
            (before.actual_minutes == null
              ? null
              : Number(before.actual_minutes)) === minutes &&
            (before.rpe == null ? null : Number(before.rpe)) === rpe;
          if (window?.status !== "ABIERTA") {
            if (unchanged) continue;
            throw new ApiError(
              409,
              "Esta sesión no está abierta para registrar RPE.",
            );
          }
        }
        await db
          .prepare(
            "INSERT INTO session_participation (id,session_id,player_id,attendance_status,availability_status,actual_minutes,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(session_id,player_id) DO UPDATE SET attendance_status=excluded.attendance_status,actual_minutes=excluded.actual_minutes,notes=excluded.notes,updated_at=excluded.updated_at",
          )
          .bind(
            `participation-${weekId}-${session}-${playerId}`,
            sessionId,
            playerId,
            attendance,
            String(row.availability ?? "COMPLETO"),
            minutes,
            String(row.note ?? ""),
            now,
            now,
          )
          .run();
        if (rpe == null)
          await db
            .prepare(
              "DELETE FROM session_rpe WHERE session_id=? AND player_id=?",
            )
            .bind(sessionId, playerId)
            .run();
        else
          await db
            .prepare(
              "INSERT INTO session_rpe (id,session_id,player_id,rpe,source,submitted_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(session_id,player_id) DO UPDATE SET rpe=excluded.rpe,source=excluded.source,updated_at=excluded.updated_at",
            )
            .bind(
              `rpe-${weekId}-${session}-${playerId}`,
              sessionId,
              playerId,
              rpe,
              auth.role === "PLAYER" ? "PLAYER" : "STAFF",
              now,
              now,
            )
            .run();
        const after = { attendance, minutes, rpe };
        if (JSON.stringify(before) !== JSON.stringify(after))
          await audit(
            auth,
            "UPDATE_SESSION_RECORD",
            "session_participation",
            `${sessionId}:${playerId}`,
            before,
            after,
            request.headers.get("cf-ray"),
          );
      } else if (domain === "wellbeing") {
        if (!playerId) continue;
        const values = {
          sleep: num(row.sleep, 0, 16, true),
          mood: num(row.mood, 1, 5, true),
          fatigue: num(row.fatigue, 1, 5, true),
          pain: num(row.pain, 0, 10, true),
          stress: num(row.stress, 1, 5, true),
          notes: String(row.notes ?? ""),
        };
        const before = await db
          .prepare(
            "SELECT sleep_hours,mood,fatigue,pain,stress,notes FROM weekly_wellness WHERE week_id=? AND player_id=?",
          )
          .bind(weekKey, playerId)
          .first();
        await db
          .prepare(
            "INSERT INTO weekly_wellness (id,week_id,player_id,sleep_hours,mood,fatigue,pain,stress,notes,source,submitted_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(week_id,player_id) DO UPDATE SET sleep_hours=excluded.sleep_hours,mood=excluded.mood,fatigue=excluded.fatigue,pain=excluded.pain,stress=excluded.stress,notes=excluded.notes,source=excluded.source,updated_at=excluded.updated_at",
          )
          .bind(
            `wellness-${weekId}-${playerId}`,
            weekKey,
            playerId,
            values.sleep,
            values.mood,
            values.fatigue,
            values.pain,
            values.stress,
            values.notes,
            auth.role === "PLAYER" ? "PLAYER" : "STAFF",
            now,
            now,
            now,
          )
          .run();
        await audit(
          auth,
          "UPDATE_WELLNESS",
          "weekly_wellness",
          `${weekKey}:${playerId}`,
          before,
          values,
          request.headers.get("cf-ray"),
        );
      } else if (domain === "availability") {
        if (!playerId) continue;
        const value = String(row.value);
        if (
          ![
            "COMPLETO",
            "MODIFICADO",
            "RECUPERACIÓN",
            "NO DISPONIBLE",
            "AUSENTE",
          ].includes(value)
        )
          throw new ApiError(400, "La disponibilidad no es válida.");
        const before = await db
          .prepare(
            "SELECT availability,note FROM player_week_status WHERE week_id=? AND player_id=?",
          )
          .bind(weekKey, playerId)
          .first();
        await db
          .prepare(
            "INSERT INTO player_week_status (id,week_id,player_id,availability,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(week_id,player_id) DO UPDATE SET availability=excluded.availability,note=excluded.note,updated_at=excluded.updated_at",
          )
          .bind(
            `status-${weekId}-${playerId}`,
            weekKey,
            playerId,
            value,
            String(row.note ?? ""),
            now,
            now,
          )
          .run();
        await audit(
          auth,
          "UPDATE_AVAILABILITY",
          "player_week_status",
          `${weekKey}:${playerId}`,
          before,
          { value, note: row.note ?? "" },
          request.headers.get("cf-ray"),
        );
      } else if (domain === "matches") {
        if (!playerId) continue;
        const minutes = num(row.minutes, 0, 180, true);
        const minutesRecorded = minutes == null ? 0 : 1;
        const rpe = num(row.rpe, 0, 10, true);
        const squad = String(row.convocation);
        if (!["TITULAR", "SUPLENTE", "NO CONVOCADO"].includes(squad))
          throw new ApiError(400, "La convocatoria no es válida.");
        const matchId = `match-${weekId}`;
        const before = await db
          .prepare(
            "SELECT squad_status,minutes,rpe,observation FROM match_participation WHERE match_id=? AND player_id=?",
          )
          .bind(matchId, playerId)
          .first();
        await db
          .prepare(
            "INSERT INTO match_participation (id,match_id,player_id,squad_status,minutes,minutes_recorded,rpe,source,observation,compensatory,compensatory_minutes,compensatory_rpe,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(match_id,player_id) DO UPDATE SET squad_status=excluded.squad_status,minutes=excluded.minutes,minutes_recorded=excluded.minutes_recorded,rpe=excluded.rpe,source=excluded.source,observation=excluded.observation,compensatory=excluded.compensatory,compensatory_minutes=excluded.compensatory_minutes,compensatory_rpe=excluded.compensatory_rpe,updated_at=excluded.updated_at",
          )
          .bind(
            `match-participation-${weekId}-${playerId}`,
            matchId,
            playerId,
            squad,
            minutes ?? 0,
            minutesRecorded,
            rpe,
            auth.role === "PLAYER" ? "PLAYER" : "STAFF",
            String(row.observation ?? ""),
            row.compensatory ? 1 : 0,
            num(row.compensatoryMinutes, 0, 180) ?? 0,
            num(row.compensatoryRpe, 0, 10, true),
            now,
            now,
          )
          .run();
        await audit(
          auth,
          "UPDATE_MATCH_PARTICIPATION",
          "match_participation",
          `${matchId}:${playerId}`,
          before,
          row,
          request.headers.get("cf-ray"),
        );
      } else if (domain === "painRecords") {
        if (!playerId) continue;
        const intensity = num(row.intensity, 0, 10) as number;
        await db
          .prepare(
            "INSERT INTO pain_records (id,team_id,season_id,week_id,player_id,date,body_area,intensity,limitation,observation,source,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET body_area=excluded.body_area,intensity=excluded.intensity,limitation=excluded.limitation,observation=excluded.observation,updated_at=excluded.updated_at",
          )
          .bind(
            String(row.id),
            auth.teamId,
            SEASON_ID,
            weekKey,
            playerId,
            String(row.date),
            String(row.zone),
            intensity,
            String(row.limitation),
            String(row.note ?? ""),
            auth.role === "PLAYER" ? "PLAYER" : "STAFF",
            now,
            now,
          )
          .run();
        await audit(
          auth,
          "UPSERT_PAIN_CONTEXT",
          "pain_record",
          String(row.id),
          null,
          row,
          request.headers.get("cf-ray"),
        );
      } else if (domain === "alerts") {
        if (!playerId) continue;
        const status = String(row.status);
        if (
          !["NUEVA", "REVISADA", "EN SEGUIMIENTO", "CERRADA"].includes(status)
        )
          throw new ApiError(400, "El estado de revisión no es válido.");
        const before = await db
          .prepare("SELECT status,note FROM alerts WHERE id=?")
          .bind(String(row.id))
          .first();
        await db
          .prepare(
            "INSERT INTO alerts (id,team_id,season_id,week_id,player_id,type,reason,status,note,created_at,updated_at) VALUES (?,?,?,?,?,'MONITORING',?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,note=excluded.note,reviewed_by=excluded.reviewed_by,reviewed_at=CURRENT_TIMESTAMP,updated_at=excluded.updated_at",
          )
          .bind(
            String(row.id),
            auth.teamId,
            SEASON_ID,
            weekKey,
            playerId,
            String(row.reason ?? "Señal de monitorización"),
            status,
            String(row.note ?? ""),
            now,
            now,
          )
          .run();
        await db
          .prepare(
            "INSERT INTO alert_reviews (id,alert_id,user_id,from_status,to_status,note) VALUES (?,?,?,?,?,?)",
          )
          .bind(
            crypto.randomUUID(),
            String(row.id),
            auth.userId,
            before ? String((before as Record<string, unknown>).status) : null,
            status,
            String(row.note ?? ""),
          )
          .run();
        await audit(
          auth,
          "REVIEW_ALERT",
          "alert",
          String(row.id),
          before,
          { status, note: row.note ?? "" },
          request.headers.get("cf-ray"),
        );
      } else if (domain === "plans") {
        if (auth.role === "PLAYER")
          throw new ApiError(
            403,
            "No tienes permisos para modificar sesiones.",
          );
        const session = Number(row.session);
        const plannedDuration = num(row.plannedDuration, 0, 240) as number;
        await db
          .prepare(
            "UPDATE training_sessions SET session_name=?,date=?,time=?,md_context=?,session_type=?,planned_duration=?,notes=?,status=?,updated_at=? WHERE id=? AND team_id=?",
          )
          .bind(
            String(row.name),
            String(row.date),
            String(row.time),
            String(row.md),
            String(row.type),
            plannedDuration,
            String(row.notes ?? ""),
            String(row.status ?? (row.closed ? "CERRADA" : "ABIERTA")),
            now,
            `session-${weekId}-${session}`,
            auth.teamId,
          )
          .run();
        await audit(
          auth,
          "UPDATE_SESSION_PLAN",
          "training_session",
          `session-${weekId}-${session}`,
          null,
          row,
          request.headers.get("cf-ray"),
        );
      } else if (domain === "thresholds") {
        const validated = validatedThresholdRows?.[rowIndex];
        if (!validated)
          throw new ApiError(400, "Los umbrales enviados no son válidos.");
        for (const [key, parsed] of Object.entries(validated)) {
          await db
            .prepare(
              "INSERT INTO thresholds (id,team_id,key,value,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(team_id,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
            )
            .bind(`threshold-${key}`, auth.teamId, key, parsed, now, now)
            .run();
        }
        await audit(
          auth,
          "UPDATE_THRESHOLDS",
          "thresholds",
          auth.teamId,
          null,
          validated,
          request.headers.get("cf-ray"),
        );
      }
    }
    return Response.json({ ok: true, savedAt: now });
  } catch (error) {
    return apiError(error);
  }
}
