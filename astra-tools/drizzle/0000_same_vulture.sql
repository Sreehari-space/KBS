CREATE TABLE `revision_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`project` text NOT NULL,
	`object_key` text NOT NULL,
	`bytes` integer NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_revision_assets_owner_project` ON `revision_assets` (`owner`,`project`);--> statement-breakpoint
CREATE TABLE `revision_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`payload` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_revision_projects_owner` ON `revision_projects` (`owner`);--> statement-breakpoint
CREATE TABLE `revision_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`project` text NOT NULL,
	`token_hash` text NOT NULL,
	`digest` text NOT NULL,
	`object_key` text NOT NULL,
	`request_ids` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires` integer NOT NULL,
	`created` integer NOT NULL,
	`name` text,
	`note` text,
	`decided` integer
);
--> statement-breakpoint
CREATE INDEX `idx_revision_reviews_owner_project` ON `revision_reviews` (`owner`,`project`);--> statement-breakpoint
CREATE INDEX `idx_revision_reviews_owner_created` ON `revision_reviews` (`owner`,`created`);--> statement-breakpoint
CREATE TABLE `revision_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL
);
