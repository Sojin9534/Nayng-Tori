CREATE TABLE `album_likes` (
	`id` text PRIMARY KEY NOT NULL,
	`cat_id` text NOT NULL,
	`album_entry_id` text NOT NULL,
	`visitor_key` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `album_likes_entry_visitor_unique` ON `album_likes` (`album_entry_id`,`visitor_key`);--> statement-breakpoint
CREATE INDEX `idx_album_likes_entry` ON `album_likes` (`album_entry_id`);