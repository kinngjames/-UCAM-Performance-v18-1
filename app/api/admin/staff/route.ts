import {
  ApiError,
  apiError,
  audit,
  ensureSeeded,
  requireAuth,
} from "../../../../lib/server/platform";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, ["ADMIN"]);
    const db = await ensureSeeded();
    const rows = await db
      .prepare(
        "SELECT id,name,email,role,active,invite_status,last_access_at,created_at FROM staff_permissions WHERE team_id=? ORDER BY role,name",
      )
      .bind(auth.teamId)
      .all();
    return Response.json({ staff: rows.results });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, ["ADMIN"]);
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      role?: string;
    };
    const name = body.name?.trim() ?? "";
    const email = body.email?.trim().toLocaleLowerCase("es-ES") ?? "";
    const role = body.role ?? "STAFF";
    if (
      !name ||
      !/^\S+@\S+\.\S+$/.test(email) ||
      !["STAFF", "ADMIN"].includes(role)
    )
      throw new ApiError(400, "Revisa el nombre, el correo y el rol.");
    const db = await ensureSeeded();
    const now = new Date().toISOString();
    const id = `staff-${crypto.randomUUID()}`;
    const userId = `user-${crypto.randomUUID()}`;
    await db.batch([
      db
        .prepare(
          "INSERT INTO users (id,email,display_name,auth_provider,active,created_at,updated_at) VALUES (?,?,?,'CHATGPT',1,?,?)",
        )
        .bind(userId, email, name, now, now),
      db
        .prepare(
          "INSERT INTO staff_permissions (id,team_id,user_id,email,name,role,active,invite_status,invited_by,created_at,updated_at) VALUES (?,?,?,?,?,?,1,'PENDING',?,?,?)",
        )
        .bind(
          id,
          auth.teamId,
          userId,
          email,
          name,
          role,
          auth.userId,
          now,
          now,
        ),
      db
        .prepare(
          "INSERT INTO team_memberships (id,team_id,user_id,role,active,created_at,updated_at) VALUES (?,?,?,?,1,?,?)",
        )
        .bind(
          `membership-${crypto.randomUUID()}`,
          auth.teamId,
          userId,
          role,
          now,
          now,
        ),
    ]);
    await audit(
      auth,
      "INVITE_STAFF",
      "staff_permission",
      id,
      null,
      { name, email, role },
      request.headers.get("cf-ray"),
    );
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth(request, ["ADMIN"]);
    const body = (await request.json()) as {
      id?: string;
      role?: string;
      active?: boolean;
    };
    if (!body.id || !["STAFF", "ADMIN"].includes(body.role ?? ""))
      throw new ApiError(400, "La modificación no es válida.");
    const db = await ensureSeeded();
    const before = await db
      .prepare(
        "SELECT role,active FROM staff_permissions WHERE id=? AND team_id=?",
      )
      .bind(body.id, auth.teamId)
      .first();
    if (!before)
      throw new ApiError(404, "No se ha encontrado este miembro del staff.");
    await db
      .prepare(
        "UPDATE staff_permissions SET role=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND team_id=?",
      )
      .bind(body.role, body.active === false ? 0 : 1, body.id, auth.teamId)
      .run();
    await audit(
      auth,
      "UPDATE_STAFF_PERMISSION",
      "staff_permission",
      body.id,
      before,
      body,
      request.headers.get("cf-ray"),
    );
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
