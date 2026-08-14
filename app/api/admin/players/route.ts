import {
  ApiError,
  apiError,
  audit,
  ensureSeeded,
  hashPin,
  requireAuth,
} from "../../../../lib/server/platform";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, ["STAFF", "ADMIN"]);
    const body = (await request.json()) as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    const number = Number(body.shirtNumber);
    const position = String(body.position ?? "").trim();
    if (
      !name ||
      !Number.isInteger(number) ||
      number < 0 ||
      number > 999 ||
      !position
    )
      throw new ApiError(400, "Revisa el nombre, el dorsal y la posición.");
    const db = await ensureSeeded();
    const duplicate = await db
      .prepare(
        "SELECT id,display_name FROM players WHERE team_id=? AND shirt_number=? LIMIT 1",
      )
      .bind(auth.teamId, number)
      .first<{ id: string; display_name: string }>();
    if (duplicate)
      throw new ApiError(
        409,
        `El dorsal ${number} ya pertenece a ${duplicate.display_name}.`,
      );
    const id = `player-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO players (id,team_id,name,display_name,shirt_number,position,date_of_birth,dominant_foot,notes,access_active,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,0,1,?,?)",
      )
      .bind(
        id,
        auth.teamId,
        name.toLocaleUpperCase("es-ES"),
        name,
        number,
        position,
        String(body.dateOfBirth ?? ""),
        String(body.dominantFoot ?? ""),
        String(body.notes ?? ""),
        now,
        now,
      )
      .run();
    await audit(
      auth,
      "CREATE_PLAYER",
      "player",
      id,
      null,
      body,
      request.headers.get("cf-ray"),
    );
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth(request, ["STAFF", "ADMIN"]);
    const body = (await request.json()) as {
      id?: string;
      action?:
        | "UPDATE"
        | "ARCHIVE"
        | "ACTIVATE"
        | "REGENERATE_PIN"
        | "DISABLE_ACCESS";
      name?: string;
      shirtNumber?: number;
      position?: string;
      dateOfBirth?: string;
      dominantFoot?: string;
      notes?: string;
    };
    if (!body.id || !body.action)
      throw new ApiError(400, "La operación no es válida.");
    const db = await ensureSeeded();
    const before = await db
      .prepare(
        "SELECT name,display_name,shirt_number,position,date_of_birth,dominant_foot,notes,active,access_active FROM players WHERE id=? AND team_id=?",
      )
      .bind(body.id, auth.teamId)
      .first();
    if (!before) throw new ApiError(404, "No se ha encontrado el jugador.");
    if (body.action === "UPDATE") {
      const name = String(body.name ?? "").trim();
      const number = Number(body.shirtNumber);
      const position = String(body.position ?? "").trim();
      if (
        !name ||
        !Number.isInteger(number) ||
        number < 0 ||
        number > 999 ||
        !position
      )
        throw new ApiError(400, "Revisa el nombre, el dorsal y la posición.");
      const duplicate = await db
        .prepare(
          "SELECT id,display_name FROM players WHERE team_id=? AND shirt_number=? AND id<>? LIMIT 1",
        )
        .bind(auth.teamId, number, body.id)
        .first<{ id: string; display_name: string }>();
      if (duplicate)
        throw new ApiError(
          409,
          `El dorsal ${number} ya pertenece a ${duplicate.display_name}.`,
        );
      await db
        .prepare(
          "UPDATE players SET name=?,display_name=?,shirt_number=?,position=?,date_of_birth=?,dominant_foot=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND team_id=?",
        )
        .bind(
          name.toLocaleUpperCase("es-ES"),
          name,
          number,
          position,
          String(body.dateOfBirth ?? ""),
          String(body.dominantFoot ?? ""),
          String(body.notes ?? ""),
          body.id,
          auth.teamId,
        )
        .run();
    }
    if (body.action === "ARCHIVE")
      await db
        .prepare(
          "UPDATE players SET active=0,access_active=0,archived_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND team_id=?",
        )
        .bind(body.id, auth.teamId)
        .run();
    if (body.action === "ACTIVATE")
      await db
        .prepare(
          "UPDATE players SET active=1,archived_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND team_id=?",
        )
        .bind(body.id, auth.teamId)
        .run();
    if (body.action === "DISABLE_ACCESS")
      await db
        .prepare(
          "UPDATE players SET access_active=0,pin_salt=NULL,pin_hash=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND team_id=?",
        )
        .bind(body.id, auth.teamId)
        .run();
    let pin: string | undefined;
    if (body.action === "REGENERATE_PIN") {
      pin = String(
        (crypto.getRandomValues(new Uint32Array(1))[0] % 900000) + 100000,
      );
      const salt = crypto.randomUUID();
      const hash = await hashPin(pin, salt);
      await db
        .prepare(
          "UPDATE players SET pin_salt=?,pin_hash=?,access_active=1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND team_id=?",
        )
        .bind(salt, hash, body.id, auth.teamId)
        .run();
    }
    await audit(
      auth,
      body.action,
      "player",
      body.id,
      before,
      body.action === "UPDATE" ? body : { action: body.action },
      request.headers.get("cf-ray"),
    );
    return Response.json({ ok: true, pin });
  } catch (error) {
    return apiError(error);
  }
}
