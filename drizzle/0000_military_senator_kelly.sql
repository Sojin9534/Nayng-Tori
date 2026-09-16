CREATE TABLE `album_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`cat_id` text NOT NULL,
	`image_key` text,
	`fallback_url` text,
	`caption` text NOT NULL,
	`taken_at` text NOT NULL,
	`milestone` text,
	`is_public` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cats` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`birth_date` text NOT NULL,
	`breed` text DEFAULT '브리티시 숏헤어' NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`share_slug` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cats_share_slug_unique` ON `cats` (`share_slug`);--> statement-breakpoint
CREATE TABLE `life_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`cat_id` text NOT NULL,
	`author_id` text NOT NULL,
	`type` text NOT NULL,
	`value` real,
	`unit` text,
	`status` text,
	`memo` text DEFAULT '' NOT NULL,
	`occurred_at` text NOT NULL
);
