CREATE TABLE `alert_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`alert_id` text NOT NULL,
	`user_id` text,
	`from_status` text,
	`to_status` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`alert_id`) REFERENCES `alerts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `alert_reviews_alert_idx` ON `alert_reviews` (`alert_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`season_id` text NOT NULL,
	`week_id` text,
	`player_id` text NOT NULL,
	`type` text NOT NULL,
	`value` text,
	`reference` text,
	`reason` text NOT NULL,
	`status` text DEFAULT 'NUEVA' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`closed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`week_id`) REFERENCES `weeks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `alerts_team_status_idx` ON `alerts` (`team_id`,`status`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`season_id` text,
	`actor_user_id` text,
	`actor_player_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`request_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_team_created_idx` ON `audit_log` (`team_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`user_id` text,
	`player_id` text,
	`team_id` text NOT NULL,
	`role` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_sessions_token_unique` ON `auth_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `auth_sessions_expiry_idx` ON `auth_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `brand_settings` (
	`team_id` text PRIMARY KEY NOT NULL,
	`organization_name` text NOT NULL,
	`team_name` text NOT NULL,
	`logo_url` text NOT NULL,
	`primary_color` text NOT NULL,
	`secondary_color` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`identity_key` text NOT NULL,
	`ip_hash` text,
	`success` integer NOT NULL,
	`attempted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `login_attempt_identity_idx` ON `login_attempts` (`identity_key`,`attempted_at`);--> statement-breakpoint
CREATE TABLE `match_participation` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`player_id` text NOT NULL,
	`squad_status` text NOT NULL,
	`minutes` integer DEFAULT 0 NOT NULL,
	`rpe` real,
	`source` text,
	`observation` text DEFAULT '' NOT NULL,
	`compensatory` integer DEFAULT false NOT NULL,
	`compensatory_minutes` integer DEFAULT 0 NOT NULL,
	`compensatory_rpe` real,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_participation_unique` ON `match_participation` (`match_id`,`player_id`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`season_id` text NOT NULL,
	`week_id` text NOT NULL,
	`rival` text NOT NULL,
	`date` text NOT NULL,
	`time` text,
	`venue` text NOT NULL,
	`result` text,
	`competition` text,
	`round` text,
	`notes` text DEFAULT '' NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`week_id`) REFERENCES `weeks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matches_week_unique` ON `matches` (`week_id`);--> statement-breakpoint
CREATE TABLE `notification_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text,
	`player_id` text,
	`type` text NOT NULL,
	`channel` text DEFAULT 'IN_APP' NOT NULL,
	`payload_json` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`scheduled_at` text,
	`sent_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pain_records` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`season_id` text NOT NULL,
	`week_id` text,
	`player_id` text NOT NULL,
	`date` text NOT NULL,
	`body_area` text NOT NULL,
	`intensity` real NOT NULL,
	`limitation` text NOT NULL,
	`observation` text DEFAULT '' NOT NULL,
	`source` text NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`week_id`) REFERENCES `weeks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pain_player_date_idx` ON `pain_records` (`player_id`,`date`);--> statement-breakpoint
CREATE TABLE `player_measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`season_id` text NOT NULL,
	`player_id` text NOT NULL,
	`measured_at` text NOT NULL,
	`metric` text NOT NULL,
	`value` real NOT NULL,
	`unit` text NOT NULL,
	`source` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `measurement_player_metric_idx` ON `player_measurements` (`player_id`,`metric`,`measured_at`);--> statement-breakpoint
CREATE TABLE `player_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`season_id` text NOT NULL,
	`player_id` text NOT NULL,
	`author_user_id` text,
	`visibility` text DEFAULT 'STAFF_ONLY' NOT NULL,
	`note` text NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `notes_player_idx` ON `player_notes` (`player_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `player_week_status` (
	`id` text PRIMARY KEY NOT NULL,
	`week_id` text NOT NULL,
	`player_id` text NOT NULL,
	`availability` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`week_id`) REFERENCES `weeks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `week_status_player_unique` ON `player_week_status` (`week_id`,`player_id`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`display_name` text NOT NULL,
	`shirt_number` integer NOT NULL,
	`position` text NOT NULL,
	`date_of_birth` text,
	`dominant_foot` text,
	`avatar` text,
	`notes` text,
	`pin_salt` text,
	`pin_hash` text,
	`access_active` integer DEFAULT true NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_team_number_unique` ON `players` (`team_id`,`shirt_number`);--> statement-breakpoint
CREATE INDEX `players_team_name_idx` ON `players` (`team_id`,`display_name`);--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`name` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `seasons_team_idx` ON `seasons` (`team_id`);--> statement-breakpoint
CREATE TABLE `session_participation` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`player_id` text NOT NULL,
	`attendance_status` text NOT NULL,
	`availability_status` text DEFAULT 'COMPLETO' NOT NULL,
	`actual_minutes` integer,
	`modified_training` integer DEFAULT false NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `training_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participation_session_player_unique` ON `session_participation` (`session_id`,`player_id`);--> statement-breakpoint
CREATE TABLE `session_rpe` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`player_id` text NOT NULL,
	`rpe` real NOT NULL,
	`source` text NOT NULL,
	`submitted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `training_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rpe_session_player_unique` ON `session_rpe` (`session_id`,`player_id`);--> statement-breakpoint
CREATE TABLE `staff_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`invite_status` text DEFAULT 'PENDING' NOT NULL,
	`pin_salt` text,
	`pin_hash` text,
	`last_access_at` text,
	`invited_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_team_email_unique` ON `staff_permissions` (`team_id`,`email`);--> statement-breakpoint
CREATE TABLE `team_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_team_user_unique` ON `team_memberships` (`team_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `team_settings` (
	`team_id` text PRIMARY KEY NOT NULL,
	`usual_sessions` integer DEFAULT 4 NOT NULL,
	`usual_match_day` text DEFAULT 'Sábado' NOT NULL,
	`timezone` text DEFAULT 'Europe/Madrid' NOT NULL,
	`notifications_enabled` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_name` text NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`timezone` text DEFAULT 'Europe/Madrid' NOT NULL,
	`data_mode` text DEFAULT 'DEMO' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `thresholds` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`key` text NOT NULL,
	`value` real NOT NULL,
	`updated_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `thresholds_team_key_unique` ON `thresholds` (`team_id`,`key`);--> statement-breakpoint
CREATE TABLE `training_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`season_id` text NOT NULL,
	`week_id` text NOT NULL,
	`session_number` integer NOT NULL,
	`date` text NOT NULL,
	`time` text,
	`session_name` text NOT NULL,
	`session_type` text NOT NULL,
	`md_context` text,
	`planned_duration` integer DEFAULT 0 NOT NULL,
	`planned_rpe` real DEFAULT 0 NOT NULL,
	`planned_load` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'PLANIFICADA' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text,
	`closed_at` text,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`week_id`) REFERENCES `weeks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_week_number_unique` ON `training_sessions` (`week_id`,`session_number`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`display_name` text NOT NULL,
	`auth_provider` text DEFAULT 'APP' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`last_login_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `weekly_wellness` (
	`id` text PRIMARY KEY NOT NULL,
	`week_id` text NOT NULL,
	`player_id` text NOT NULL,
	`sleep_hours` real,
	`mood` real,
	`fatigue` real,
	`pain` real,
	`stress` real,
	`notes` text DEFAULT '' NOT NULL,
	`source` text NOT NULL,
	`submitted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`week_id`) REFERENCES `weeks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wellness_week_player_unique` ON `weekly_wellness` (`week_id`,`player_id`);--> statement-breakpoint
CREATE TABLE `weeks` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`season_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`label` text NOT NULL,
	`period` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weeks_season_sequence_unique` ON `weeks` (`season_id`,`sequence`);