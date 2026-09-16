CREATE TABLE `album_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`cat_id` text NOT NULL,
	`album_entry_id` text NOT NULL,
	`nickname` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_album_comments_entry_time` ON `album_comments` (`album_entry_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `guestbook_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`cat_id` text NOT NULL,
	`nickname` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_guestbook_cat_time` ON `guestbook_entries` (`cat_id`,`created_at`);