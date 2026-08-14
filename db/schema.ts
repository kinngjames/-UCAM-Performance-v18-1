import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
};

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email"),
    displayName: text("display_name").notNull(),
    authProvider: text("auth_provider").notNull().default("APP"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    lastLoginAt: text("last_login_at"),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  organizationName: text("organization_name").notNull(),
  name: text("name").notNull(),
  category: text("category"),
  timezone: text("timezone").notNull().default("Europe/Madrid"),
  dataMode: text("data_mode").notNull().default("DEMO"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const seasons = sqliteTable(
  "seasons",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id),
    name: text("name").notNull(),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    archivedAt: text("archived_at"),
    ...timestamps,
  },
  (table) => [index("seasons_team_idx").on(table.teamId)],
);

export const teamMemberships = sqliteTable(
  "team_memberships",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("memberships_team_user_unique").on(table.teamId, table.userId),
  ],
);

export const staffPermissions = sqliteTable(
  "staff_permissions",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id),
    userId: text("user_id").references(() => users.id),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    inviteStatus: text("invite_status").notNull().default("PENDING"),
    pinSalt: text("pin_salt"),
    pinHash: text("pin_hash"),
    lastAccessAt: text("last_access_at"),
    invitedBy: text("invited_by"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("staff_team_email_unique").on(table.teamId, table.email),
  ],
);

export const players = sqliteTable(
  "players",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id),
    userId: text("user_id").references(() => users.id),
    name: text("name").notNull(),
    displayName: text("display_name").notNull(),
    shirtNumber: integer("shirt_number").notNull(),
    position: text("position").notNull(),
    dateOfBirth: text("date_of_birth"),
    dominantFoot: text("dominant_foot"),
    avatar: text("avatar"),
    notes: text("notes"),
    pinSalt: text("pin_salt"),
    pinHash: text("pin_hash"),
    accessActive: integer("access_active", { mode: "boolean" })
      .notNull()
      .default(true),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    archivedAt: text("archived_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("players_team_number_unique").on(
      table.teamId,
      table.shirtNumber,
    ),
    index("players_team_name_idx").on(table.teamId, table.displayName),
  ],
);

export const weeks = sqliteTable(
  "weeks",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id),
    seasonId: text("season_id")
      .notNull()
      .references(() => seasons.id),
    sequence: integer("sequence").notNull(),
    label: text("label").notNull(),
    period: text("period").notNull(),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("weeks_season_sequence_unique").on(
      table.seasonId,
      table.sequence,
    ),
  ],
);

export const trainingSessions = sqliteTable(
  "training_sessions",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id),
    seasonId: text("season_id")
      .notNull()
      .references(() => seasons.id),
    weekId: text("week_id")
      .notNull()
      .references(() => weeks.id),
    sessionNumber: integer("session_number").notNull(),
    date: text("date").notNull(),
    time: text("time"),
    sessionName: text("session_name").notNull(),
    sessionType: text("session_type").notNull(),
    mdContext: text("md_context"),
    plannedDuration: integer("planned_duration").notNull().default(0),
    plannedRpe: real("planned_rpe").notNull().default(0),
    plannedLoad: real("planned_load").notNull().default(0),
    status: text("status").notNull().default("PLANIFICADA"),
    notes: text("notes").notNull().default(""),
    createdBy: text("created_by"),
    closedAt: text("closed_at"),
    deletedAt: text("deleted_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("sessions_week_number_unique").on(
      table.weekId,
      table.sessionNumber,
    ),
  ],
);

export const sessionParticipation = sqliteTable(
  "session_participation",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => trainingSessions.id),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id),
    attendanceStatus: text("attendance_status").notNull(),
    availabilityStatus: text("availability_status")
      .notNull()
      .default("COMPLETO"),
    actualMinutes: integer("actual_minutes"),
    modifiedTraining: integer("modified_training", { mode: "boolean" })
      .notNull()
      .default(false),
    notes: text("notes").notNull().default(""),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("participation_session_player_unique").on(
      table.sessionId,
      table.playerId,
    ),
  ],
);

export const sessionRpe = sqliteTable(
  "session_rpe",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => trainingSessions.id),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id),
    rpe: real("rpe").notNull(),
    source: text("source").notNull(),
    submittedAt: text("submitted_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("rpe_session_player_unique").on(
      table.sessionId,
      table.playerId,
    ),
  ],
);

export const matches = sqliteTable(
  "matches",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id),
    seasonId: text("season_id")
      .notNull()
      .references(() => seasons.id),
    weekId: text("week_id")
      .notNull()
      .references(() => weeks.id),
    rival: text("rival").notNull(),
    date: text("date").notNull(),
    time: text("time"),
    venue: text("venue").notNull(),
    result: text("result"),
    competition: text("competition"),
    round: text("round"),
    notes: text("notes").notNull().default(""),
    deletedAt: text("deleted_at"),
    ...timestamps,
  },
  (table) => [uniqueIndex("matches_week_unique").on(table.weekId)],
);

export const matchParticipation = sqliteTable(
  "match_participation",
  {
    id: text("id").primaryKey(),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id),
    squadStatus: text("squad_status").notNull(),
    minutes: integer("minutes").notNull().default(0),
    minutesRecorded: integer("minutes_recorded", { mode: "boolean" })
      .notNull()
      .default(true),
    rpe: real("rpe"),
    source: text("source"),
    observation: text("observation").notNull().default(""),
    compensatory: integer("compensatory", { mode: "boolean" })
      .notNull()
      .default(false),
    compensatoryMinutes: integer("compensatory_minutes").notNull().default(0),
    compensatoryRpe: real("compensatory_rpe"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("match_participation_unique").on(table.matchId, table.playerId),
  ],
);

export const weeklyWellness = sqliteTable(
  "weekly_wellness",
  {
    id: text("id").primaryKey(),
    weekId: text("week_id")
      .notNull()
      .references(() => weeks.id),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id),
    sleepHours: real("sleep_hours"),
    mood: real("mood"),
    fatigue: real("fatigue"),
    pain: real("pain"),
    stress: real("stress"),
    notes: text("notes").notNull().default(""),
    source: text("source").notNull(),
    submittedAt: text("submitted_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("wellness_week_player_unique").on(table.weekId, table.playerId),
  ],
);

export const painRecords = sqliteTable(
  "pain_records",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id),
    seasonId: text("season_id")
      .notNull()
      .references(() => seasons.id),
    weekId: text("week_id").references(() => weeks.id),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id),
    date: text("date").notNull(),
    bodyArea: text("body_area").notNull(),
    intensity: real("intensity").notNull(),
    limitation: text("limitation").notNull(),
    observation: text("observation").notNull().default(""),
    source: text("source").notNull(),
    deletedAt: text("deleted_at"),
    ...timestamps,
  },
  (table) => [index("pain_player_date_idx").on(table.playerId, table.date)],
);

export const playerMeasurements = sqliteTable(
  "player_measurements",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id),
    seasonId: text("season_id")
      .notNull()
      .references(() => seasons.id),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id),
    measuredAt: text("measured_at").notNull(),
    metric: text("metric").notNull(),
    value: real("value").notNull(),
    unit: text("unit").notNull(),
    source: text("source").notNull(),
    ...timestamps,
  },
  (table) => [
    index("measurement_player_metric_idx").on(
      table.playerId,
      table.metric,
      table.measuredAt,
    ),
  ],
);

export const playerWeekStatus = sqliteTable(
  "player_week_status",
  {
    id: text("id").primaryKey(),
    weekId: text("week_id")
      .notNull()
      .references(() => weeks.id),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id),
    availability: text("availability").notNull(),
    note: text("note").notNull().default(""),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("week_status_player_unique").on(table.weekId, table.playerId),
  ],
);

export const playerNotes = sqliteTable(
  "player_notes",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id),
    seasonId: text("season_id")
      .notNull()
      .references(() => seasons.id),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id),
    authorUserId: text("author_user_id").references(() => users.id),
    visibility: text("visibility").notNull().default("STAFF_ONLY"),
    note: text("note").notNull(),
    deletedAt: text("deleted_at"),
    ...timestamps,
  },
  (table) => [index("notes_player_idx").on(table.playerId, table.createdAt)],
);

export const alerts = sqliteTable(
  "alerts",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id),
    seasonId: text("season_id")
      .notNull()
      .references(() => seasons.id),
    weekId: text("week_id").references(() => weeks.id),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id),
    type: text("type").notNull(),
    value: text("value"),
    reference: text("reference"),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("NUEVA"),
    note: text("note").notNull().default(""),
    reviewedBy: text("reviewed_by"),
    reviewedAt: text("reviewed_at"),
    closedAt: text("closed_at"),
    ...timestamps,
  },
  (table) => [index("alerts_team_status_idx").on(table.teamId, table.status)],
);

export const alertReviews = sqliteTable(
  "alert_reviews",
  {
    id: text("id").primaryKey(),
    alertId: text("alert_id")
      .notNull()
      .references(() => alerts.id),
    userId: text("user_id").references(() => users.id),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    note: text("note").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("alert_reviews_alert_idx").on(table.alertId, table.createdAt),
  ],
);

export const thresholds = sqliteTable(
  "thresholds",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id),
    key: text("key").notNull(),
    value: real("value").notNull(),
    updatedBy: text("updated_by"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("thresholds_team_key_unique").on(table.teamId, table.key),
  ],
);

export const teamSettings = sqliteTable("team_settings", {
  teamId: text("team_id")
    .primaryKey()
    .references(() => teams.id),
  usualSessions: integer("usual_sessions").notNull().default(4),
  usualMatchDay: text("usual_match_day").notNull().default("Sábado"),
  timezone: text("timezone").notNull().default("Europe/Madrid"),
  notificationsEnabled: integer("notifications_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  ...timestamps,
});

export const brandSettings = sqliteTable("brand_settings", {
  teamId: text("team_id")
    .primaryKey()
    .references(() => teams.id),
  organizationName: text("organization_name").notNull(),
  teamName: text("team_name").notNull(),
  logoUrl: text("logo_url").notNull(),
  primaryColor: text("primary_color").notNull(),
  secondaryColor: text("secondary_color").notNull(),
  ...timestamps,
});

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    userId: text("user_id").references(() => users.id),
    playerId: text("player_id").references(() => players.id),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id),
    role: text("role").notNull(),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
    lastSeenAt: text("last_seen_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("auth_sessions_token_unique").on(table.tokenHash),
    index("auth_sessions_expiry_idx").on(table.expiresAt),
  ],
);

export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: text("id").primaryKey(),
    identityKey: text("identity_key").notNull(),
    ipHash: text("ip_hash"),
    success: integer("success", { mode: "boolean" }).notNull(),
    attemptedAt: text("attempted_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("login_attempt_identity_idx").on(
      table.identityKey,
      table.attemptedAt,
    ),
  ],
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id),
    seasonId: text("season_id").references(() => seasons.id),
    actorUserId: text("actor_user_id"),
    actorPlayerId: text("actor_player_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    requestId: text("request_id"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("audit_team_created_idx").on(table.teamId, table.createdAt),
  ],
);

export const notificationQueue = sqliteTable("notification_queue", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  userId: text("user_id"),
  playerId: text("player_id"),
  type: text("type").notNull(),
  channel: text("channel").notNull().default("IN_APP"),
  payloadJson: text("payload_json").notNull(),
  status: text("status").notNull().default("PENDING"),
  scheduledAt: text("scheduled_at"),
  sentAt: text("sent_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
