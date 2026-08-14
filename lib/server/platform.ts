import { getD1 } from "../../db";
import { CALENDAR, INITIAL_PLAYERS, INITIAL_THRESHOLDS } from "../../app/data";
import {
  ACTIVE_SESSION,
  ACTIVE_WEEK_ID,
  seedAlerts,
  seedAvailability,
  seedMatches,
  seedPainRecords,
  seedSessionPlans,
  seedSessions,
  seedWellbeing,
} from "../../app/phase2-data";

export const TEAM_ID = "team-ucam-juvenil-b";
export const SEASON_ID = "season-2026-27";
export const COOKIE_NAME = "ucam_session";
export const SESSION_TTL_DAYS = 14;

export type AppRole = "PLAYER" | "STAFF" | "ADMIN";
export type AuthContext = {
  role: AppRole;
  teamId: string;
  userId: string | null;
  playerId: string | null;
  email: string | null;
  displayName: string;
  authMethod: "PIN" | "DEMO_CODE" | "CHATGPT";
};

const LEGACY_PLAYER_PIN_HASHES: Record<string, [string, string]> = {
  P01: [
    "ucam-demo-P01-2026",
    "5f76e823fcd7ea3b9948f72194f45bc1d7b0f1948d18fd63354b61c4689c0c2f",
  ],
  P02: [
    "ucam-demo-P02-2026",
    "377e993b1d9557251b061936edb581b7feb89fae0ed99f99d53a511c3bb9d0d1",
  ],
  P03: [
    "ucam-demo-P03-2026",
    "583f4a6fd868622ceaa9a45df85632f44025c4d95b6d29035feea06a733135ed",
  ],
  P04: [
    "ucam-demo-P04-2026",
    "74b386d6d5b19a40319d939a1d91ccca89e16676e84faf1519bac64cc14462be",
  ],
  P05: [
    "ucam-demo-P05-2026",
    "7490bcf80096256878710475103e32ad6d0432097351d566232778cb4b50f9a3",
  ],
  P06: [
    "ucam-demo-P06-2026",
    "1f9210515b58f4b2ab57bb14eebe8eb3a41ea472689ed9d7dfd2d42c5e14a50e",
  ],
  P07: [
    "ucam-demo-P07-2026",
    "650e75896269c600789272bf6d370b458318238143d0d394ab086883f3a0e5ed",
  ],
  P08: [
    "ucam-demo-P08-2026",
    "a357d4f18b45fd37656cb48181484ca0469e0e86fb6c67a07676b701502583ea",
  ],
  P09: [
    "ucam-demo-P09-2026",
    "04c8cfae0115df9242784fbc42ad81d099c07c90a1b83a25cb6c08b9e2c6a29c",
  ],
  P10: [
    "ucam-demo-P10-2026",
    "acbd2b228feebf620b1a8b84d912f6940dc867c031e0e8b361b879497ef70a1e",
  ],
  P11: [
    "ucam-demo-P11-2026",
    "e0dc66b27d5905a849a0abc22e14b308caea57e7933138930c9dc5f188d17821",
  ],
  P12: [
    "ucam-demo-P12-2026",
    "0b27d4163445344cc5e4b11c13add7762ef28c71f95b273e7aee6c567716069b",
  ],
  P13: [
    "ucam-demo-P13-2026",
    "c6b6b4cc0ee7e619b71c4ef0aac84f8ed707cf3aa7053b8a01d1f693c4b5f740",
  ],
  P14: [
    "ucam-demo-P14-2026",
    "4a2db7bf2b9be1134d1d34bbf0ca3ebea7ee7f5e11216838abe75cf95e91dcf4",
  ],
  P15: [
    "ucam-demo-P15-2026",
    "9301a06263a3df8872b90379078b08e904c6846cf9d759434676f50263e19ae3",
  ],
  P16: [
    "ucam-demo-P16-2026",
    "5ec01eb59e465c3a1bd0f818f5843128fbdf9acaddd652b35c9cf5ffe6f60abb",
  ],
  P17: [
    "ucam-demo-P17-2026",
    "231db8ff540963c283f9353432220b0aa1b44d056f0c82e8b93872bc3e4aeba4",
  ],
  P18: [
    "ucam-demo-P18-2026",
    "4a8c79322c4018f61cbfdde12864a8aaeed250717dd348d196833a93afa0a0eb",
  ],
  P19: [
    "ucam-demo-P19-2026",
    "d2aaabdc8c7a1992ca4006f143216b192e39cd22e898b35b1bcd970f8518b2a9",
  ],
  P20: [
    "ucam-demo-P20-2026",
    "deaed7f680cb50909b567db3e47aecffa57f9445fab096988f2c7168499bf61a",
  ],
};

// Cloudflare Workers admite como máximo 100.000 iteraciones PBKDF2. Estos
// hashes sustituyen de forma segura los hashes demo creados inicialmente con
// 120.000 iteraciones, que no podían verificarse en producción.
const PLAYER_PIN_HASHES: Record<string, [string, string]> = {
  P01: ["ucam-demo-P01-2026", "8ec82806095b62d0af8ddd7b459c6eaca1cfa0294c7e3985e58b5566f6e1b2f8"],
  P02: ["ucam-demo-P02-2026", "c31dac8d00a5b1cac2004779f8d833869fe22e02164442851c2843786a332957"],
  P03: ["ucam-demo-P03-2026", "08b6e710c55b56621d3219c2099c621dfd41a02da9f47cfb9b4f6bec4543f74d"],
  P04: ["ucam-demo-P04-2026", "4046befdfa7100da92a045b3bc56bb6aa6b00a800986693ac7d6142a8ea43603"],
  P05: ["ucam-demo-P05-2026", "ce13df21c17808e082502f3a3c0500dd8e45e7cd43e50534b8b87c1e57b57fab"],
  P06: ["ucam-demo-P06-2026", "cbcaf4f368f891518f91e96e5c63712756c4bf18f20940aff437fea8b5bceaaa"],
  P07: ["ucam-demo-P07-2026", "e2e3d473be680d1d80444a79f7c2995d0f5f7d2382ca8e389905545918874887"],
  P08: ["ucam-demo-P08-2026", "df45f270bb1e677b161f10673a70a371fdb21e456f66fe5e8e2ecf159a34997f"],
  P09: ["ucam-demo-P09-2026", "bd5834438c61f991b1dd3e39168c7f96e3756570eeaa3105030405d020137565"],
  P10: ["ucam-demo-P10-2026", "6555844b342fd902bb9c693476c6bc1ec4dd86b674d644cad645eb778f9c9de1"],
  P11: ["ucam-demo-P11-2026", "48b8805075e6975705d9aade50ed5e8b2c699cc7055b11fa3dfd83e2a16f648d"],
  P12: ["ucam-demo-P12-2026", "8d1f71ebfb0c1f8567facca5d6d6528542f4da663eaeba52f44767df6d0381a4"],
  P13: ["ucam-demo-P13-2026", "946d4c81ef716b7d1d76ab4e16bb7279227b1fec135419e623efd7e2a03174e2"],
  P14: ["ucam-demo-P14-2026", "152c72bc58c2d840b6416ab4803bf93ac3b2447b197d140fa3eeaaf92d7cc9ae"],
  P15: ["ucam-demo-P15-2026", "e3f34f032746c4aabe5a12ac5cf01c2bdcbecce9288f045f423e009f038b1959"],
  P16: ["ucam-demo-P16-2026", "f6907e047828352cf6eb87a114f656f16f97bfa92646a52c6147f94182227b51"],
  P17: ["ucam-demo-P17-2026", "35b6a268371d71f351e6001487a1e7ec3dc563f42b1e8146958a7bc17d19f298"],
  P18: ["ucam-demo-P18-2026", "ec9db68f244ac7f3e56e3d70c8dc53ca4b4106ccc3912f7c4bde9dc2986df180"],
  P19: ["ucam-demo-P19-2026", "4cd64ee3c4dfd0169676f63d0ed79101a9c86249293a247fa69f0457f6bd0ec9"],
  P20: ["ucam-demo-P20-2026", "288decb6febc5649506c90da45a0409d57447977a46c9e9965fe2ce8569d8b8a"],
};

const DEMO_STAFF = [
  {
    email: "admin@ucam-performance.demo",
    name: "Administrador UCAM",
    role: "ADMIN",
    salt: "ucam-staff-admin@ucam-performance.demo",
    hash: "65e8cfbac26420b9bbe99b1c6ab8c980e76305a644ef562dcc8f39213b6665db",
    legacyHash: "e2e055c93b361e5b6a6b60fa013bce0be5e59b3ac3e73a8f0ac8d9d454ca81f8",
  },
  {
    email: "staff@juvenilb.es",
    name: "Staff Juvenil B",
    role: "STAFF",
    salt: "ucam-staff-staff@juvenilb.es",
    hash: "6f7c138484a6fa1d85f9f805dda2ee973dbd62a45daa9ef0f85a5d541359acd9",
    legacyHash: "12df5dee01de4bc3de4462a2ea96be5259a9378e7f37bdbfdda495c27c30432c",
  },
  {
    email: "entrenador@juvenilb.es",
    name: "Entrenador Juvenil B",
    role: "STAFF",
    salt: "ucam-staff-entrenador@juvenilb.es",
    hash: "87a5d623227f86c465477a8793fdc3ac2fdec1cdc60df0442d0b61df400ed9fb",
    legacyHash: "79921d31a1a7e02cf83c32310347c7614f23160cf0fb0d5831872726d68394e1",
  },
  {
    email: "preparador@juvenilb.es",
    name: "Preparador Juvenil B",
    role: "STAFF",
    salt: "ucam-staff-preparador@juvenilb.es",
    hash: "597902435a980e61b782c593c07ed2a13f87e82c3b3a36ee6626ec86ca423dfa",
    legacyHash: "875ab5254df8d440c455f3d399699d233a3b1d04857421aa4d2d934d26394ec1",
  },
] as const;

const titleCase = (value: string) =>
  value
    .toLocaleLowerCase("es-ES")
    .replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase("es-ES"));
const hex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
};

export async function sha256(value: string) {
  return hex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

export async function hashPin(pin: string, salt: string) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(salt),
      iterations: 100000,
    },
    material,
    256,
  );
  return hex(bits);
}

async function batch(
  db: D1Database,
  statements: D1PreparedStatement[],
  size = 60,
) {
  for (let index = 0; index < statements.length; index += size)
    await db.batch(statements.slice(index, index + size));
}

let credentialMigration: Promise<void> | null = null;

async function migrateLegacyCredentialHashes(db: D1Database) {
  if (!credentialMigration) {
    credentialMigration = (async () => {
      const statements: D1PreparedStatement[] = [];
      for (const [playerId, [, hash]] of Object.entries(PLAYER_PIN_HASHES)) {
        const legacyHash = LEGACY_PLAYER_PIN_HASHES[playerId]?.[1];
        if (!legacyHash) continue;
        statements.push(
          db
            .prepare(
              "UPDATE players SET pin_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND team_id=? AND pin_hash=?",
            )
            .bind(hash, playerId, TEAM_ID, legacyHash),
        );
      }
      for (const member of DEMO_STAFF) {
        statements.push(
          db
            .prepare(
              "UPDATE staff_permissions SET pin_hash=?,updated_at=CURRENT_TIMESTAMP WHERE team_id=? AND email=? AND pin_hash=?",
            )
            .bind(member.hash, TEAM_ID, member.email, member.legacyHash),
        );
      }
      await batch(db, statements);
    })().catch((error) => {
      credentialMigration = null;
      throw error;
    });
  }
  await credentialMigration;
}

export async function ensureSeeded() {
  const db = getD1();
  const existing = await db
    .prepare("SELECT id FROM teams WHERE id = ?")
    .bind(TEAM_ID)
    .first();
  if (existing) {
    await migrateLegacyCredentialHashes(db);
    return db;
  }

  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        "INSERT INTO teams (id, organization_name, name, category, timezone, data_mode, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
      )
      .bind(
        TEAM_ID,
        "UCAM Universidad Católica de Murcia",
        "UCAM Juvenil B",
        "Fútbol formativo",
        "Europe/Madrid",
        "DEMO",
        now,
        now,
      ),
    db
      .prepare(
        "INSERT INTO seasons (id, team_id, name, starts_on, ends_on, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
      )
      .bind(
        SEASON_ID,
        TEAM_ID,
        "2026/2027",
        "2026-08-10",
        "2027-06-30",
        now,
        now,
      ),
    db
      .prepare(
        "INSERT INTO team_settings (team_id, usual_sessions, usual_match_day, timezone, notifications_enabled, created_at, updated_at) VALUES (?, 4, ?, ?, 0, ?, ?)",
      )
      .bind(TEAM_ID, "Sábado", "Europe/Madrid", now, now),
    db
      .prepare(
        "INSERT INTO brand_settings (team_id, organization_name, team_name, logo_url, primary_color, secondary_color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        TEAM_ID,
        "UCAM Universidad Católica de Murcia",
        "UCAM Performance",
        "https://www.ucam.edu/sites/default/files/public/la-universidad/identidad-visual/logos-ucam/logo-horizontal-ucam-universidad-azul.svg",
        "#004379",
        "#EDAB00",
        now,
        now,
      ),
  ];
  for (const member of DEMO_STAFF) {
    const userId = `user-${member.email}`;
    statements.push(
      db
        .prepare(
          "INSERT INTO users (id, email, display_name, auth_provider, active, created_at, updated_at) VALUES (?, ?, ?, 'APP', 1, ?, ?)",
        )
        .bind(userId, member.email, member.name, now, now),
      db
        .prepare(
          "INSERT INTO staff_permissions (id, team_id, user_id, email, name, role, active, invite_status, pin_salt, pin_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, 'ACCEPTED', ?, ?, ?, ?)",
        )
        .bind(
          `staff-${member.email}`,
          TEAM_ID,
          userId,
          member.email,
          member.name,
          member.role,
          member.salt,
          member.hash,
          now,
          now,
        ),
      db
        .prepare(
          "INSERT INTO team_memberships (id, team_id, user_id, role, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
        )
        .bind(
          `membership-${member.email}`,
          TEAM_ID,
          userId,
          member.role,
          now,
          now,
        ),
    );
  }
  for (const player of INITIAL_PLAYERS) {
    const [salt, hash] = PLAYER_PIN_HASHES[player.id];
    statements.push(
      db
        .prepare(
          "INSERT INTO players (id, team_id, name, display_name, shirt_number, position, date_of_birth, dominant_foot, notes, pin_salt, pin_hash, access_active, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)",
        )
        .bind(
          player.id,
          TEAM_ID,
          player.name,
          titleCase(player.name),
          player.number,
          player.position,
          player.birthDate,
          player.dominantFoot,
          player.notes,
          salt,
          hash,
          now,
          now,
        ),
    );
  }
  for (const week of CALENDAR) {
    statements.push(
      db
        .prepare(
          "INSERT INTO weeks (id, team_id, season_id, sequence, label, period, starts_on, ends_on, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          `week-${week.id}`,
          TEAM_ID,
          SEASON_ID,
          week.id,
          week.label,
          week.period,
          week.dates[0],
          week.dates[3],
          now,
          now,
        ),
    );
  }
  for (const plan of seedSessionPlans()) {
    const status =
      plan.weekId === ACTIVE_WEEK_ID
        ? plan.session < ACTIVE_SESSION
          ? "CERRADA"
          : plan.session === ACTIVE_SESSION
            ? "ABIERTA"
            : "PLANIFICADA"
        : plan.weekId < ACTIVE_WEEK_ID
          ? "CERRADA"
          : "PLANIFICADA";
    statements.push(
      db
        .prepare(
          "INSERT INTO training_sessions (id, team_id, season_id, week_id, session_number, date, time, session_name, session_type, md_context, planned_duration, planned_rpe, planned_load, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          `session-${plan.weekId}-${plan.session}`,
          TEAM_ID,
          SEASON_ID,
          `week-${plan.weekId}`,
          plan.session,
          plan.date,
          plan.time,
          plan.name,
          plan.type,
          plan.md,
          plan.plannedDuration,
          plan.targetRpe,
          plan.plannedDuration * plan.targetRpe,
          status,
          plan.notes,
          now,
          now,
        ),
    );
  }
  const availability = seedAvailability();
  const matchSeeds = seedMatches(availability);
  for (const week of CALENDAR) {
    const sample = matchSeeds.find((item) => item.weekId === week.id)!;
    statements.push(
      db
        .prepare(
          "INSERT INTO matches (id, team_id, season_id, week_id, rival, date, venue, competition, round, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          `match-${week.id}`,
          TEAM_ID,
          SEASON_ID,
          `week-${week.id}`,
          sample.opponent,
          sample.date,
          sample.venue,
          week.period,
          week.label,
          week.notes,
          now,
          now,
        ),
    );
  }
  for (const [key, value] of Object.entries(INITIAL_THRESHOLDS))
    statements.push(
      db
        .prepare(
          "INSERT INTO thresholds (id, team_id, key, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(`threshold-${key}`, TEAM_ID, key, value, now, now),
    );
  await batch(db, statements);
  await seedWeekData(db, ACTIVE_WEEK_ID, "SYSTEM_SEED");
  return db;
}

export async function seedWeekData(
  db: D1Database,
  weekId: number,
  source: string,
) {
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  const availability = seedAvailability().filter(
    (item) => item.weekId === weekId,
  );
  const sessions = seedSessions().filter((item) => item.weekId === weekId);
  const wellness = seedWellbeing().filter((item) => item.weekId === weekId);
  const matches = seedMatches(seedAvailability()).filter(
    (item) => item.weekId === weekId,
  );
  const pains = seedPainRecords().filter((item) => item.weekId === weekId);
  const alerts = seedAlerts().filter((item) => item.weekId === weekId);
  for (const item of availability)
    statements.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO player_week_status (id, week_id, player_id, availability, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          `status-${weekId}-${item.playerId}`,
          `week-${weekId}`,
          item.playerId,
          item.value,
          item.note,
          now,
          now,
        ),
    );
  for (const item of sessions) {
    const sessionId = `session-${weekId}-${item.session}`;
    statements.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO session_participation (id, session_id, player_id, attendance_status, availability_status, actual_minutes, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          `participation-${weekId}-${item.session}-${item.playerId}`,
          sessionId,
          item.playerId,
          item.attendance,
          availability.find((entry) => entry.playerId === item.playerId)
            ?.value ?? "COMPLETO",
          item.minutes,
          item.note,
          now,
          now,
        ),
    );
    if (item.rpe != null)
      statements.push(
        db
          .prepare(
            "INSERT OR IGNORE INTO session_rpe (id, session_id, player_id, rpe, source, submitted_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          )
          .bind(
            `rpe-${weekId}-${item.session}-${item.playerId}`,
            sessionId,
            item.playerId,
            item.rpe,
            source,
            now,
            now,
          ),
      );
  }
  for (const item of wellness)
    statements.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO weekly_wellness (id, week_id, player_id, sleep_hours, mood, fatigue, pain, stress, notes, source, submitted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          `wellness-${weekId}-${item.playerId}`,
          `week-${weekId}`,
          item.playerId,
          item.sleep,
          item.mood,
          item.fatigue,
          item.pain,
          item.stress,
          item.notes,
          source,
          now,
          now,
          now,
        ),
    );
  for (const item of matches)
    statements.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO match_participation (id, match_id, player_id, squad_status, minutes, rpe, source, observation, compensatory, compensatory_minutes, compensatory_rpe, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          `match-participation-${weekId}-${item.playerId}`,
          `match-${weekId}`,
          item.playerId,
          item.convocation,
          item.minutes,
          item.rpe,
          source,
          item.observation,
          item.compensatory ? 1 : 0,
          item.compensatoryMinutes,
          item.compensatoryRpe,
          now,
          now,
        ),
    );
  for (const item of pains)
    statements.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO pain_records (id, team_id, season_id, week_id, player_id, date, body_area, intensity, limitation, observation, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          item.id,
          TEAM_ID,
          SEASON_ID,
          `week-${weekId}`,
          item.playerId,
          item.date,
          item.zone,
          item.intensity,
          item.limitation,
          item.note,
          source,
          now,
          now,
        ),
    );
  for (const item of alerts)
    statements.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO alerts (id, team_id, season_id, week_id, player_id, type, reason, status, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'MONITORING', ?, ?, ?, ?, ?)",
        )
        .bind(
          item.id,
          TEAM_ID,
          SEASON_ID,
          `week-${weekId}`,
          item.playerId,
          item.history[0] ?? "Señal de monitorización",
          item.status,
          item.note,
          now,
          now,
        ),
    );
  await batch(db, statements);
}

export async function createSession(
  context: Omit<AuthContext, "authMethod">,
  method: AuthContext["authMethod"],
  request: Request,
) {
  const db = await ensureSeeded();
  const token = randomToken();
  const tokenHash = await sha256(token);
  const id = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 86400000,
  ).toISOString();
  await db
    .prepare(
      "INSERT INTO auth_sessions (id, token_hash, user_id, player_id, team_id, role, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      id,
      tokenHash,
      context.userId,
      context.playerId,
      context.teamId,
      context.role,
      expiresAt,
    )
    .run();
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return {
    token,
    cookie: `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_DAYS * 86400}${secure}`,
    auth: { ...context, authMethod: method } as AuthContext,
  };
}

function readCookie(request: Request, name: string) {
  const source = request.headers.get("cookie") ?? "";
  return (
    source
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? null
  );
}

export async function resolveAuth(
  request: Request,
): Promise<AuthContext | null> {
  const db = await ensureSeeded();
  const token = readCookie(request, COOKIE_NAME);
  if (token) {
    const tokenHash = await sha256(token);
    const row = await db
      .prepare(
        "SELECT s.role, s.team_id, s.user_id, s.player_id, u.email, COALESCE(u.display_name, p.display_name) AS display_name FROM auth_sessions s LEFT JOIN users u ON u.id=s.user_id LEFT JOIN players p ON p.id=s.player_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at > ?",
      )
      .bind(tokenHash, new Date().toISOString())
      .first<Record<string, unknown>>();
    if (row) {
      await db
        .prepare(
          "UPDATE auth_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE token_hash=?",
        )
        .bind(tokenHash)
        .run();
      return {
        role: row.role as AppRole,
        teamId: String(row.team_id),
        userId: row.user_id ? String(row.user_id) : null,
        playerId: row.player_id ? String(row.player_id) : null,
        email: row.email ? String(row.email) : null,
        displayName: String(row.display_name ?? "Usuario"),
        authMethod: row.player_id ? "PIN" : "DEMO_CODE",
      };
    }
  }
  const headerEmail = request.headers
    .get("oai-authenticated-user-email")
    ?.trim()
    .toLocaleLowerCase("es-ES");
  if (headerEmail) {
    const staff = await db
      .prepare(
        "SELECT sp.role, sp.team_id, sp.user_id, sp.name FROM staff_permissions sp WHERE sp.email=? AND sp.active=1",
      )
      .bind(headerEmail)
      .first<Record<string, unknown>>();
    if (staff)
      return {
        role: staff.role as AppRole,
        teamId: String(staff.team_id),
        userId: String(staff.user_id),
        playerId: null,
        email: headerEmail,
        displayName: String(staff.name),
        authMethod: "CHATGPT",
      };
  }
  return null;
}

export async function requireAuth(
  request: Request,
  allowed: AppRole[] = ["PLAYER", "STAFF", "ADMIN"],
) {
  const auth = await resolveAuth(request);
  if (!auth)
    throw new ApiError(401, "Tu sesión no es válida. Vuelve a identificarte.");
  if (!allowed.includes(auth.role))
    throw new ApiError(403, "No tienes permisos para realizar esta acción.");
  return auth;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function apiError(error: unknown) {
  if (error instanceof ApiError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error(error);
  return Response.json(
    { error: "No hemos podido completar la operación. Inténtalo de nuevo." },
    { status: 500 },
  );
}

export async function audit(
  auth: AuthContext,
  action: string,
  entityType: string,
  entityId: string,
  before: unknown,
  after: unknown,
  requestId?: string | null,
) {
  const db = getD1();
  await db
    .prepare(
      "INSERT INTO audit_log (id, team_id, season_id, actor_user_id, actor_player_id, action, entity_type, entity_id, before_json, after_json, request_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      crypto.randomUUID(),
      auth.teamId,
      SEASON_ID,
      auth.userId,
      auth.playerId,
      action,
      entityType,
      entityId,
      before == null ? null : JSON.stringify(before),
      after == null ? null : JSON.stringify(after),
      requestId ?? null,
    )
    .run();
}

export function assertOwnPlayer(auth: AuthContext, playerId: string) {
  if (auth.role === "PLAYER" && auth.playerId !== playerId)
    throw new ApiError(
      403,
      "Solo puedes consultar y registrar tus propios datos.",
    );
}

export async function recordLoginAttempt(
  identity: string,
  success: boolean,
  request: Request,
) {
  const db = getD1();
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  await db
    .prepare(
      "INSERT INTO login_attempts (id, identity_key, ip_hash, success) VALUES (?, ?, ?, ?)",
    )
    .bind(crypto.randomUUID(), identity, await sha256(ip), success ? 1 : 0)
    .run();
}

export async function assertNotRateLimited(identity: string, request: Request) {
  const db = getD1();
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  const result = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM login_attempts WHERE identity_key=? AND ip_hash=? AND success=0 AND attempted_at >= datetime('now','-15 minutes')",
    )
    .bind(identity, await sha256(ip))
    .first<{ count: number }>();
  if ((result?.count ?? 0) >= 5)
    throw new ApiError(
      429,
      "Demasiados intentos. Espera 15 minutos antes de volver a probar.",
    );
}
