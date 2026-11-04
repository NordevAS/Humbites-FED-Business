CREATE TABLE `demo_media` (
	`id` text PRIMARY KEY NOT NULL,
	`sandbox_id` text NOT NULL,
	`truck_id` text NOT NULL,
	`item_id` text,
	`staging_key` text NOT NULL,
	`published_key` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`status` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`retain_until` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`width` integer,
	`height` integer
);
--> statement-breakpoint
CREATE INDEX `demo_media_sandbox_idx` ON `demo_media` (`sandbox_id`,`truck_id`);--> statement-breakpoint
CREATE INDEX `demo_media_expiry_idx` ON `demo_media` (`expires_at`);--> statement-breakpoint
CREATE TABLE `demo_receipts` (
	`booking_id` text PRIMARY KEY NOT NULL,
	`sandbox_id` text NOT NULL,
	`token_hash` text NOT NULL,
	FOREIGN KEY (`sandbox_id`) REFERENCES `demo_sandboxes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `demo_receipt_token` ON `demo_receipts` (`token_hash`);--> statement-breakpoint
CREATE TABLE `demo_sandboxes` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`state` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `demo_sandbox_expiry` ON `demo_sandboxes` (`expires_at`);