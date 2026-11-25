ALTER TABLE `folder_entries` DROP INDEX `folder_entries_number_unique`;--> statement-breakpoint
ALTER TABLE `folder_entries` ADD `number_suffix` varchar(1);--> statement-breakpoint
ALTER TABLE `folder_entries` ADD CONSTRAINT `folder_entries_number_unique` UNIQUE(`folder_id`,`number`,(coalesce(`number_suffix`, '')));
