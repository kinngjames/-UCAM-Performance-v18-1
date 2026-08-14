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
    const body = (await request.json()) as { playerId?: string; pin?: string };
    const playerId = body.playerId?.trim() ?? "";
    const pin = body.pin?.trim() ?? "";
    if (!playerId || !/^\d{4,6}$/.test(pin))
      return Response.json(
        { error: "Introduce un PIN válido de 4 a 6 cifras." },
        { status: 400 },
      );
    const db = await ensureSeeded();
    await assertNotRateLimited(`PLAYER:${playerId}`, request);
    const player = await db
      .prepare(
        "SELECT id, display_name, pin_salt, pin_hash, access_active, active FROM players WHERE id=? AND team_id=?",
      )
      .bind(playerId, TEAM_ID)
      .first<Record<string, unknown>>();
    const valid = Boolean(
      player &&
        player.access_active &&
        player.active &&
        player.pin_salt &&
        player.pin_hash &&
        (await hashPin(pin, String(player.pin_salt))) === player.pin_hash,
    );
    await recordLoginAttempt(`PLAYER:${playerId}`, valid, request);
    if (!valid)
      return Response.json(
        { error: "El jugador o el PIN no son correctos." },
        { status: 401 },
      );
    const session = await createSession(
      {
        role: "PLAYER",
        teamId: TEAM_ID,
        userId: null,
        playerId,
        email: null,
        displayName: String(player!.display_name),
      },
      "PIN",
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
