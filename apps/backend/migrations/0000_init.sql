CREATE TABLE `languages` (
	`code` text PRIMARY KEY NOT NULL,
	`name_ja` text NOT NULL,
	`sort_order` integer DEFAULT 100 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `metrics_daily` (
	`repo_id` integer NOT NULL,
	`calculated_date` text NOT NULL,
	`stars_7d_increase` integer DEFAULT 0 NOT NULL,
	`stars_30d_increase` integer DEFAULT 0 NOT NULL,
	`stars_7d_rate` real DEFAULT 0 NOT NULL,
	`stars_30d_rate` real DEFAULT 0 NOT NULL,
	PRIMARY KEY(`repo_id`, `calculated_date`)
);
--> statement-breakpoint
CREATE INDEX `idx_metrics_date` ON `metrics_daily` (`calculated_date`);--> statement-breakpoint
CREATE TABLE `ranking_weekly` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`year` integer NOT NULL,
	`week_number` integer NOT NULL,
	`language` text DEFAULT 'all' NOT NULL,
	`rank_data` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ranking_weekly_year_week` ON `ranking_weekly` (`year`,`week_number`);--> statement-breakpoint
CREATE INDEX `idx_ranking_weekly_unique` ON `ranking_weekly` (`year`,`week_number`,`language`);--> statement-breakpoint
CREATE TABLE `repo_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`repo_id` integer NOT NULL,
	`stars` integer DEFAULT 0 NOT NULL,
	`forks` integer DEFAULT 0 NOT NULL,
	`watchers` integer DEFAULT 0 NOT NULL,
	`open_issues` integer DEFAULT 0 NOT NULL,
	`snapshot_date` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_snapshots_date` ON `repo_snapshots` (`snapshot_date`);--> statement-breakpoint
CREATE INDEX `idx_snapshots_repo` ON `repo_snapshots` (`repo_id`,`snapshot_date`);--> statement-breakpoint
CREATE TABLE `repositories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`repo_id` integer NOT NULL,
	`name` text NOT NULL,
	`full_name` text NOT NULL,
	`owner` text NOT NULL,
	`language` text,
	`description` text,
	`html_url` text NOT NULL,
	`homepage` text,
	`topics` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`pushed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repositories_repo_id_unique` ON `repositories` (`repo_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `repositories_full_name_unique` ON `repositories` (`full_name`);--> statement-breakpoint
CREATE INDEX `idx_repos_language` ON `repositories` (`language`);--> statement-breakpoint
CREATE INDEX `idx_repos_updated` ON `repositories` (`updated_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`github_id` integer NOT NULL,
	`username` text NOT NULL,
	`email` text,
	`avatar_url` text,
	`plan` text DEFAULT 'FREE' NOT NULL,
	`credits_remaining` integer DEFAULT 0 NOT NULL,
	`stripe_customer_id` text,
	`subscription_expires_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_github_id_unique` ON `users` (`github_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_stripe_customer_id_unique` ON `users` (`stripe_customer_id`);--> statement-breakpoint
CREATE INDEX `idx_users_github_id` ON `users` (`github_id`);--> statement-breakpoint
CREATE INDEX `idx_users_stripe` ON `users` (`stripe_customer_id`);--> statement-breakpoint
INSERT OR IGNORE INTO `languages` (`code`, `name_ja`, `sort_order`) VALUES
  ('all', 'すべて', 0),
  ('TypeScript', 'TypeScript', 1),
  ('Python', 'Python', 2),
  ('JavaScript', 'JavaScript', 3),
  ('Go', 'Go', 4),
  ('Rust', 'Rust', 5),
  ('Java', 'Java', 6);
