CREATE TABLE `legal_data` (
	`id` int NOT NULL DEFAULT 1,
	`imprint_data` json NOT NULL,
	`privacy_data` json NOT NULL,
	`updated_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `legal_data_id` PRIMARY KEY(`id`),
	CONSTRAINT `legal_data_single_row_check` CHECK(`legal_data`.`id` = 1)
);
--> statement-breakpoint
CREATE TABLE `legal_documents` (
	`document` varchar(16) NOT NULL,
	`mode` varchar(16),
	`url` text,
	`accepted_template` json,
	`accepted_at` timestamp(6),
	`published_hash` varchar(64),
	`as_of` date,
	`updated_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `legal_documents_document` PRIMARY KEY(`document`),
	CONSTRAINT `legal_documents_document_check` CHECK(`legal_documents`.`document` in ('imprint', 'privacy')),
	CONSTRAINT `legal_documents_mode_check` CHECK(`legal_documents`.`mode` is null or `legal_documents`.`mode` in ('link', 'generated'))
);
--> statement-breakpoint
-- S-7: existing links from S-4 become mode `link`
INSERT INTO `legal_documents` (`document`, `mode`, `url`)
SELECT 'imprint', 'link', `imprint_url` FROM `club_settings` WHERE `id` = 1 AND `imprint_url` IS NOT NULL;--> statement-breakpoint
INSERT INTO `legal_documents` (`document`, `mode`, `url`)
SELECT 'privacy', 'link', `privacy_url` FROM `club_settings` WHERE `id` = 1 AND `privacy_url` IS NOT NULL;--> statement-breakpoint
ALTER TABLE `club_settings` DROP COLUMN `imprint_url`;--> statement-breakpoint
ALTER TABLE `club_settings` DROP COLUMN `privacy_url`;