import {
  ApiError,
  apiError,
  audit,
  ensureSeeded,
  requireAuth,
} from "../../../lib/server/platform";

function parseLine(line: string) {
  const out: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      value += '"';
      i++;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      out.push(value.trim());
      value = "";
    } else value += char;
  }
  out.push(value.trim());
  return out;
}
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, ["ADMIN"]);
    const body = (await request.json()) as { csv?: string };
    const source = body.csv ?? "";
    if (source.length > 500000)
      throw new ApiError(413, "El archivo es demasiado grande.");
    const lines = source
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter(Boolean);
    if (lines.length < 2)
      throw new ApiError(400, "El CSV no contiene jugadores.");
    const headers = parseLine(lines[0]).map((item) =>
      item.toLocaleLowerCase("es-ES"),
    );
    const required = ["nombre", "dorsal", "posicion"];
    if (required.some((key) => !headers.includes(key)))
      throw new ApiError(400, "El CSV debe incluir nombre, dorsal y posicion.");
    const db = await ensureSeeded();
    let imported = 0;
    const now = new Date().toISOString();
    for (const line of lines.slice(1)) {
      const values = parseLine(line);
      const row = Object.fromEntries(
        headers.map((key, index) => [key, values[index] ?? ""]),
      );
      const number = Number(row.dorsal);
      if (!row.nombre || !Number.isInteger(number) || !row.posicion) continue;
      const id = `player-${crypto.randomUUID()}`;
      await db
        .prepare(
          "INSERT INTO players (id,team_id,name,display_name,shirt_number,position,date_of_birth,dominant_foot,access_active,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,0,1,?,?) ON CONFLICT(team_id,shirt_number) DO UPDATE SET name=excluded.name,display_name=excluded.display_name,position=excluded.position,date_of_birth=excluded.date_of_birth,dominant_foot=excluded.dominant_foot,active=1,updated_at=excluded.updated_at",
        )
        .bind(
          id,
          auth.teamId,
          row.nombre.toLocaleUpperCase("es-ES"),
          row.nombre,
          number,
          row.posicion.toLocaleUpperCase("es-ES"),
          row.nacimiento ?? "",
          row.pierna ?? "",
          now,
          now,
        )
        .run();
      imported++;
    }
    await audit(
      auth,
      "IMPORT_PLAYERS",
      "team",
      auth.teamId,
      null,
      { imported },
      request.headers.get("cf-ray"),
    );
    return Response.json({ ok: true, imported });
  } catch (error) {
    return apiError(error);
  }
}
