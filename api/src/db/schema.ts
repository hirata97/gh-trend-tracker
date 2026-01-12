import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const repositories = sqliteTable('repositories', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	repoId: integer('repo_id').unique().notNull(), // GitHub repository ID
	name: text('name').notNull(),
	fullName: text('full_name').unique().notNull(), // e.g., "facebook/react"
	owner: text('owner').notNull(),
	language: text('language'),
	description: text('description'),
	htmlUrl: text('html_url').notNull(),
	homepage: text('homepage'),
	topics: text('topics'), // JSON array as TEXT
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull(),
	pushedAt: text('pushed_at'),
}, (table) => ({
	languageIdx: index('idx_repos_language').on(table.language),
	updatedIdx: index('idx_repos_updated').on(table.updatedAt),
}));

export const repoSnapshots = sqliteTable('repo_snapshots', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	repoId: integer('repo_id').notNull(), // References repositories.repo_id
	stars: integer('stars').notNull().default(0),
	forks: integer('forks').notNull().default(0),
	watchers: integer('watchers').notNull().default(0),
	openIssues: integer('open_issues').notNull().default(0),
	snapshotDate: text('snapshot_date').notNull(), // ISO date: "2026-01-12"
	createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
	dateIdx: index('idx_snapshots_date').on(table.snapshotDate),
	repoIdx: index('idx_snapshots_repo').on(table.repoId, table.snapshotDate),
}));

export type Repository = typeof repositories.$inferSelect;
export type NewRepository = typeof repositories.$inferInsert;
export type RepoSnapshot = typeof repoSnapshots.$inferSelect;
export type NewRepoSnapshot = typeof repoSnapshots.$inferInsert;
