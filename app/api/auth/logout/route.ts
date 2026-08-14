import {
  apiError,
  COOKIE_NAME,
  ensureSeeded,
  sha256,
} from "../../../../lib/server/platform";

function readCookie(request: Request) {
  return (
    (request.headers.get("cookie") ?? "")
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${COOKIE_NAME}=`))
      ?.slice(COOKIE_NAME.length + 1) ?? null
  );
}

export async function POST(request: Request) {
  try {
    const db = await ensureSeeded();
    const token = readCookie(request);
    if (token)
      await db
        .prepare(
          "UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=?",
        )
        .bind(await sha256(token))
        .run();
    return Response.json(
      { ok: true },
      {
        headers: {
          "Set-Cookie": `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
        },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
