import {
  apiError,
  assertNotRateLimited,
  createSession,
  ensureSeeded,
  hashPin,
  recordLoginAttempt,
  TEAM_ID,
} from "../../../../lib/server/platform";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; code?: string };
    const email = body.email?.trim().toLocaleLowerCase("es-ES") ?? "";
    const code = body.code?.trim() ?? "";
    if (!email || !/^\d{6}$/.test(code))
      return Response.json(
        { error: "Introduce el correo autorizado y el código de 6 cifras." },
        { status: 400 },
      );
    const db = await ensureSeeded();
    const team = await db
      .prepare("SELECT data_mode FROM teams WHERE id=?")
      .bind(TEAM_ID)
      .first<{ data_mode: string }>();
    if (team?.data_mode !== "DEMO")
      return Response.json(
        {
          error:
            "El acceso con código solo está disponible en el entorno DEMO.",
        },
        { status: 403 },
      );
    await assertNotRateLimited(`STAFF:${email}`, request);
    const staff = await db
      .prepare(
        "SELECT user_id, name, role, pin_salt, pin_hash, active FROM staff_permissions WHERE team_id=? AND email=?",
      )
      .bind(TEAM_ID, email)
      .first<Record<string, unknown>>();
    const valid = Boolean(
      staff &&
        staff.active &&
        staff.pin_salt &&
        staff.pin_hash &&
        (await hashPin(code, String(staff.pin_salt))) === staff.pin_hash,
    );
    await recordLoginAttempt(`STAFF:${email}`, valid, request);
    if (!valid)
      return Response.json(
        { error: "El correo no está autorizado o el código no es correcto." },
        { status: 401 },
      );
    await db
      .prepare(
        "UPDATE staff_permissions SET last_access_at=CURRENT_TIMESTAMP WHERE team_id=? AND email=?",
      )
      .bind(TEAM_ID, email)
      .run();
    const session = await createSession(
      {
        role: staff!.role as "STAFF" | "ADMIN",
        teamId: TEAM_ID,
        userId: String(staff!.user_id),
        playerId: null,
        email,
        displayName: String(staff!.name),
      },
      "DEMO_CODE",
      request,
    );
    return Response.json(
      { auth: session.auth },
      { headers: { "Set-Cookie": session.cookie } },
    );
  } catch (error) {
    return apiError(error);
  }
}
