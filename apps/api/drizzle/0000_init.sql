CREATE TABLE `system_state` (
	`key` varchar(255) NOT NULL,
	`value` json NOT NULL,
	`updated_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `system_state_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`oidc_sub` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255),
	`picture_url` text,
	`is_admin` boolean NOT NULL DEFAULT false,
	`status` enum('active','blocked') NOT NULL DEFAULT 'active',
	`last_login_at` timestamp(6),
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_oidc_sub_unique` UNIQUE(`oidc_sub`)
);
--> statement-breakpoint
CREATE TABLE `ensembles` (
	`id` varchar(36) NOT NULL,
	`parent_id` varchar(36),
	`name` varchar(255) NOT NULL,
	`is_root` boolean NOT NULL DEFAULT false,
	`root_marker` tinyint GENERATED ALWAYS AS (if(`ensembles`.`is_root`, 1, null)) VIRTUAL,
	`archived_at` timestamp(6),
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `ensembles_id` PRIMARY KEY(`id`),
	CONSTRAINT `ensembles_single_root_idx` UNIQUE(`root_marker`),
	CONSTRAINT `ensembles_parent_name_idx` UNIQUE(`parent_id`,(lower(`name`))),
	CONSTRAINT `ensembles_root_check` CHECK(`ensembles`.`is_root` = (`ensembles`.`parent_id` is null))
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role_id` varchar(36) NOT NULL,
	`permission` varchar(255) NOT NULL,
	CONSTRAINT `role_permissions_role_id_permission_pk` PRIMARY KEY(`role_id`,`permission`),
	CONSTRAINT `role_permissions_known_check` CHECK(`role_permissions`.`permission` in ('score.view', 'score.create', 'score.edit', 'score.delete', 'voice.view', 'voice.create', 'voice.edit', 'voice.delete', 'tag.view', 'tag.create', 'tag.edit', 'tag.delete', 'folder.view', 'folder.create', 'folder.edit', 'folder.delete', 'event.view', 'event.create', 'event.edit', 'event.delete', 'user.view', 'user.create', 'user.edit', 'user.delete', 'role.view', 'role.create', 'role.edit', 'role.delete', 'ensemble.view', 'ensemble.create', 'ensemble.edit', 'ensemble.delete', 'sheet.upload', 'sheet.approve', 'member.view', 'config.view', 'config.edit'))
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` varchar(36) NOT NULL,
	`default_key` varchar(255),
	`name` varchar(255) NOT NULL,
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_default_key_unique` UNIQUE(`default_key`),
	CONSTRAINT `roles_name_idx` UNIQUE((lower(`name`)))
);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`user_id` varchar(36) NOT NULL,
	`ensemble_id` varchar(36) NOT NULL,
	`role_id` varchar(36) NOT NULL,
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `memberships_user_id_ensemble_id_pk` PRIMARY KEY(`user_id`,`ensemble_id`)
);
--> statement-breakpoint
CREATE TABLE `club_settings` (
	`id` int NOT NULL DEFAULT 1,
	`club_name` text NOT NULL,
	`imprint_url` text,
	`privacy_url` text,
	`login_banner` text,
	`login_auto_redirect` boolean NOT NULL DEFAULT false,
	`logo_file_key` text,
	`logo_mime` text,
	`default_ensemble_id` varchar(36),
	`default_role_id` varchar(36),
	`browser_print_page_limit` int NOT NULL DEFAULT 10,
	`public_base_url` text,
	`updated_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `club_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `club_settings_single_row_check` CHECK(`club_settings`.`id` = 1)
);
--> statement-breakpoint
CREATE TABLE `instruments` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`position` int NOT NULL,
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `instruments_id` PRIMARY KEY(`id`),
	CONSTRAINT `instruments_name_idx` UNIQUE((lower(`name`)))
);
--> statement-breakpoint
CREATE TABLE `user_voices` (
	`user_id` varchar(36) NOT NULL,
	`voice_id` varchar(36) NOT NULL,
	`position` int NOT NULL,
	CONSTRAINT `user_voices_user_id_voice_id_pk` PRIMARY KEY(`user_id`,`voice_id`)
);
--> statement-breakpoint
CREATE TABLE `voice_substitutes` (
	`voice_id` varchar(36) NOT NULL,
	`substitute_voice_id` varchar(36) NOT NULL,
	`position` int NOT NULL,
	CONSTRAINT `voice_substitutes_voice_id_substitute_voice_id_pk` PRIMARY KEY(`voice_id`,`substitute_voice_id`),
	CONSTRAINT `voice_substitutes_position_unique` UNIQUE(`voice_id`,`position`),
	CONSTRAINT `voice_substitutes_not_self_check` CHECK(`voice_substitutes`.`voice_id` <> `voice_substitutes`.`substitute_voice_id`)
);
--> statement-breakpoint
CREATE TABLE `voices` (
	`id` varchar(36) NOT NULL,
	`instrument_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`position` int NOT NULL,
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `voices_id` PRIMARY KEY(`id`),
	CONSTRAINT `voices_name_idx` UNIQUE((lower(`name`)))
);
--> statement-breakpoint
CREATE TABLE `scores` (
	`id` varchar(36) NOT NULL,
	`title` text NOT NULL,
	`composer` text,
	`arranger` text,
	`publisher` text,
	`publisher_number` text,
	`duration_seconds` int,
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `scores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sheets` (
	`id` varchar(36) NOT NULL,
	`score_id` varchar(36) NOT NULL,
	`voice_id` varchar(36) NOT NULL,
	`file_key` text NOT NULL,
	`page_count` int NOT NULL,
	`size_bytes` bigint NOT NULL,
	`upload_id` varchar(36),
	`approved_by` varchar(36),
	`approved_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `sheets_id` PRIMARY KEY(`id`),
	CONSTRAINT `sheets_score_voice_unique` UNIQUE(`score_id`,`voice_id`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` varchar(36) NOT NULL,
	`ensemble_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`date` date NOT NULL,
	`show_in_my_area` boolean NOT NULL DEFAULT false,
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `folder_entries` (
	`folder_id` varchar(36) NOT NULL,
	`score_id` varchar(36) NOT NULL,
	`number` varchar(255) NOT NULL,
	`number_sort_key` varchar(255) NOT NULL,
	CONSTRAINT `folder_entries_folder_id_score_id_pk` PRIMARY KEY(`folder_id`,`score_id`),
	CONSTRAINT `folder_entries_number_unique` UNIQUE(`folder_id`,`number`)
);
--> statement-breakpoint
CREATE TABLE `folders` (
	`id` varchar(36) NOT NULL,
	`ensemble_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`show_in_my_area` boolean NOT NULL DEFAULT false,
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `folders_id` PRIMARY KEY(`id`),
	CONSTRAINT `folders_ensemble_name_idx` UNIQUE(`ensemble_id`,(lower(`name`)))
);
--> statement-breakpoint
CREATE TABLE `setlist_entries` (
	`event_id` varchar(36) NOT NULL,
	`score_id` varchar(36) NOT NULL,
	`position` int NOT NULL,
	CONSTRAINT `setlist_entries_event_id_score_id_pk` PRIMARY KEY(`event_id`,`score_id`),
	CONSTRAINT `setlist_entries_position_unique` UNIQUE(`event_id`,`position`)
);
--> statement-breakpoint
CREATE TABLE `club_tags` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `club_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `club_tags_name_idx` UNIQUE((lower(`name`)))
);
--> statement-breakpoint
CREATE TABLE `personal_tags` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `personal_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `personal_tags_user_name_idx` UNIQUE(`user_id`,(lower(`name`)))
);
--> statement-breakpoint
CREATE TABLE `score_club_tags` (
	`score_id` varchar(36) NOT NULL,
	`tag_id` varchar(36) NOT NULL,
	CONSTRAINT `score_club_tags_score_id_tag_id_pk` PRIMARY KEY(`score_id`,`tag_id`)
);
--> statement-breakpoint
CREATE TABLE `score_personal_tags` (
	`personal_tag_id` varchar(36) NOT NULL,
	`score_id` varchar(36) NOT NULL,
	CONSTRAINT `score_personal_tags_personal_tag_id_score_id_pk` PRIMARY KEY(`personal_tag_id`,`score_id`)
);
--> statement-breakpoint
CREATE TABLE `field_definitions` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('text','number','date','select','multiselect','link','boolean') NOT NULL,
	`required` boolean NOT NULL DEFAULT false,
	`position` int NOT NULL,
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `field_definitions_id` PRIMARY KEY(`id`),
	CONSTRAINT `field_definitions_name_idx` UNIQUE((lower(`name`)))
);
--> statement-breakpoint
CREATE TABLE `field_options` (
	`id` varchar(36) NOT NULL,
	`field_id` varchar(36) NOT NULL,
	`label` varchar(255) NOT NULL,
	`position` int NOT NULL,
	CONSTRAINT `field_options_id` PRIMARY KEY(`id`),
	CONSTRAINT `field_options_label_idx` UNIQUE(`field_id`,(lower(`label`)))
);
--> statement-breakpoint
CREATE TABLE `score_field_values` (
	`score_id` varchar(36) NOT NULL,
	`field_id` varchar(36) NOT NULL,
	`value` json NOT NULL,
	CONSTRAINT `score_field_values_score_id_field_id_pk` PRIMARY KEY(`score_id`,`field_id`)
);
--> statement-breakpoint
CREATE TABLE `ensemble_lineup_voices` (
	`ensemble_id` varchar(36) NOT NULL,
	`voice_id` varchar(36) NOT NULL,
	`position` int NOT NULL,
	CONSTRAINT `ensemble_lineup_voices_ensemble_id_voice_id_pk` PRIMARY KEY(`ensemble_id`,`voice_id`),
	CONSTRAINT `ensemble_lineup_position_unique` UNIQUE(`ensemble_id`,`position`)
);
--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` varchar(36) NOT NULL,
	`uploaded_by` varchar(36),
	`file_name` text NOT NULL,
	`file_key` text,
	`page_count` int NOT NULL,
	`size_bytes` bigint NOT NULL,
	`score_id` varchar(36),
	`voice_id` varchar(36),
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`rejection_reason` text,
	`decided_by` varchar(36),
	`decided_at` timestamp(6),
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `uploads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cache_entries` (
	`key` varchar(255) NOT NULL,
	`value` json NOT NULL,
	`expires_at` timestamp(6) NOT NULL,
	CONSTRAINT `cache_entries_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `ensemble_print_rules` (
	`ensemble_id` varchar(36) NOT NULL,
	`from_pages` int NOT NULL,
	`mode` text NOT NULL,
	CONSTRAINT `ensemble_print_rules_ensemble_id_from_pages_pk` PRIMARY KEY(`ensemble_id`,`from_pages`),
	CONSTRAINT `ensemble_print_rules_from_check` CHECK(`ensemble_print_rules`.`from_pages` >= 1),
	CONSTRAINT `ensemble_print_rules_mode_check` CHECK(`ensemble_print_rules`.`mode` in ('simplex', 'duplex'))
);
--> statement-breakpoint
CREATE TABLE `seed_lock` (
	`id` int NOT NULL,
	CONSTRAINT `seed_lock_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
-- Fixed row to lock with SELECT ... FOR UPDATE (apps/api/src/db/schema/seed-lock.ts): must exist
-- before the very first seed runs, so it can't be inserted by application code.
INSERT INTO `seed_lock` (`id`) VALUES (1);
--> statement-breakpoint
ALTER TABLE `ensembles` ADD CONSTRAINT `ensembles_parent_fk` FOREIGN KEY (`parent_id`) REFERENCES `ensembles`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_ensemble_id_ensembles_id_fk` FOREIGN KEY (`ensemble_id`) REFERENCES `ensembles`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `club_settings` ADD CONSTRAINT `club_settings_default_ensemble_id_ensembles_id_fk` FOREIGN KEY (`default_ensemble_id`) REFERENCES `ensembles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `club_settings` ADD CONSTRAINT `club_settings_default_role_id_roles_id_fk` FOREIGN KEY (`default_role_id`) REFERENCES `roles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_voices` ADD CONSTRAINT `user_voices_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_voices` ADD CONSTRAINT `user_voices_voice_id_voices_id_fk` FOREIGN KEY (`voice_id`) REFERENCES `voices`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `voice_substitutes` ADD CONSTRAINT `voice_substitutes_voice_id_voices_id_fk` FOREIGN KEY (`voice_id`) REFERENCES `voices`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `voice_substitutes` ADD CONSTRAINT `voice_substitutes_substitute_voice_id_voices_id_fk` FOREIGN KEY (`substitute_voice_id`) REFERENCES `voices`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `voices` ADD CONSTRAINT `voices_instrument_id_instruments_id_fk` FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sheets` ADD CONSTRAINT `sheets_score_id_scores_id_fk` FOREIGN KEY (`score_id`) REFERENCES `scores`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sheets` ADD CONSTRAINT `sheets_voice_id_voices_id_fk` FOREIGN KEY (`voice_id`) REFERENCES `voices`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sheets` ADD CONSTRAINT `sheets_upload_id_uploads_id_fk` FOREIGN KEY (`upload_id`) REFERENCES `uploads`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sheets` ADD CONSTRAINT `sheets_approved_by_users_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `events` ADD CONSTRAINT `events_ensemble_id_ensembles_id_fk` FOREIGN KEY (`ensemble_id`) REFERENCES `ensembles`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `folder_entries` ADD CONSTRAINT `folder_entries_folder_id_folders_id_fk` FOREIGN KEY (`folder_id`) REFERENCES `folders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `folder_entries` ADD CONSTRAINT `folder_entries_score_id_scores_id_fk` FOREIGN KEY (`score_id`) REFERENCES `scores`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `folders` ADD CONSTRAINT `folders_ensemble_id_ensembles_id_fk` FOREIGN KEY (`ensemble_id`) REFERENCES `ensembles`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `setlist_entries` ADD CONSTRAINT `setlist_entries_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `setlist_entries` ADD CONSTRAINT `setlist_entries_score_id_scores_id_fk` FOREIGN KEY (`score_id`) REFERENCES `scores`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `personal_tags` ADD CONSTRAINT `personal_tags_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `score_club_tags` ADD CONSTRAINT `score_club_tags_score_id_scores_id_fk` FOREIGN KEY (`score_id`) REFERENCES `scores`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `score_club_tags` ADD CONSTRAINT `score_club_tags_tag_id_club_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `club_tags`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `score_personal_tags` ADD CONSTRAINT `score_personal_tags_personal_tag_id_personal_tags_id_fk` FOREIGN KEY (`personal_tag_id`) REFERENCES `personal_tags`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `score_personal_tags` ADD CONSTRAINT `score_personal_tags_score_id_scores_id_fk` FOREIGN KEY (`score_id`) REFERENCES `scores`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `field_options` ADD CONSTRAINT `field_options_field_id_field_definitions_id_fk` FOREIGN KEY (`field_id`) REFERENCES `field_definitions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `score_field_values` ADD CONSTRAINT `score_field_values_score_id_scores_id_fk` FOREIGN KEY (`score_id`) REFERENCES `scores`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `score_field_values` ADD CONSTRAINT `score_field_values_field_id_field_definitions_id_fk` FOREIGN KEY (`field_id`) REFERENCES `field_definitions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ensemble_lineup_voices` ADD CONSTRAINT `ensemble_lineup_voices_ensemble_id_ensembles_id_fk` FOREIGN KEY (`ensemble_id`) REFERENCES `ensembles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ensemble_lineup_voices` ADD CONSTRAINT `ensemble_lineup_voices_voice_id_voices_id_fk` FOREIGN KEY (`voice_id`) REFERENCES `voices`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `uploads` ADD CONSTRAINT `uploads_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `uploads` ADD CONSTRAINT `uploads_score_id_scores_id_fk` FOREIGN KEY (`score_id`) REFERENCES `scores`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `uploads` ADD CONSTRAINT `uploads_voice_id_voices_id_fk` FOREIGN KEY (`voice_id`) REFERENCES `voices`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `uploads` ADD CONSTRAINT `uploads_decided_by_users_id_fk` FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ensemble_print_rules` ADD CONSTRAINT `ensemble_print_rules_ensemble_id_ensembles_id_fk` FOREIGN KEY (`ensemble_id`) REFERENCES `ensembles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `users_name_idx` ON `users` ((lower(`name`)));--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` ((lower(`email`)));--> statement-breakpoint
CREATE INDEX `memberships_ensemble_idx` ON `memberships` (`ensemble_id`);--> statement-breakpoint
CREATE INDEX `memberships_role_idx` ON `memberships` (`role_id`);--> statement-breakpoint
CREATE INDEX `voices_instrument_idx` ON `voices` (`instrument_id`);--> statement-breakpoint
CREATE INDEX `events_ensemble_date_idx` ON `events` (`ensemble_id`,`date`);--> statement-breakpoint
CREATE INDEX `folder_entries_score_idx` ON `folder_entries` (`score_id`);--> statement-breakpoint
CREATE INDEX `folders_ensemble_visible_idx` ON `folders` (`ensemble_id`,`show_in_my_area`);--> statement-breakpoint
CREATE INDEX `setlist_entries_score_idx` ON `setlist_entries` (`score_id`);--> statement-breakpoint
CREATE INDEX `score_club_tags_tag_idx` ON `score_club_tags` (`tag_id`);--> statement-breakpoint
CREATE INDEX `score_personal_tags_score_idx` ON `score_personal_tags` (`score_id`);--> statement-breakpoint
CREATE INDEX `score_field_values_field_idx` ON `score_field_values` (`field_id`);--> statement-breakpoint
CREATE INDEX `uploads_status_created_idx` ON `uploads` (`status`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `uploads_uploader_idx` ON `uploads` (`uploaded_by`,`created_at`);--> statement-breakpoint
CREATE INDEX `cache_entries_expires_idx` ON `cache_entries` (`expires_at`);