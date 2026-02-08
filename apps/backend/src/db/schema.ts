import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  primaryKey,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const repositories = sqliteTable(
  'repositories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    repoId: integer('repo_id').unique().notNull(),
    name: text('name').notNull(),
    fullName: text('full_name').unique().notNull(),
    owner: text('owner').notNull(),
    language: text('language'),
    description: text('description'),
    htmlUrl: text('html_url').notNull(),
    homepage: text('homepage'),
    topics: text('topics'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    pushedAt: text('pushed_at'),
  },
  (table) => ({
    languageIdx: index('idx_repos_language').on(table.language),
    updatedIdx: index('idx_repos_updated').on(table.updatedAt),
  })
);

export const repoSnapshots = sqliteTable(
  'repo_snapshots',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    repoId: integer('repo_id').notNull(),
    stars: integer('stars').notNull().default(0),
    forks: integer('forks').notNull().default(0),
    watchers: integer('watchers').notNull().default(0),
    openIssues: integer('open_issues').notNull().default(0),
    snapshotDate: text('snapshot_date').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    dateIdx: index('idx_snapshots_date').on(table.snapshotDate),
    repoIdx: index('idx_snapshots_repo').on(table.repoId, table.snapshotDate),
  })
);

export const metricsDaily = sqliteTable(
  'metrics_daily',
  {
    repoId: integer('repo_id').notNull(),
    calculatedDate: text('calculated_date').notNull(),
    stars7dIncrease: integer('stars_7d_increase').notNull().default(0),
    stars30dIncrease: integer('stars_30d_increase').notNull().default(0),
    stars7dRate: real('stars_7d_rate').notNull().default(0.0),
    stars30dRate: real('stars_30d_rate').notNull().default(0.0),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.repoId, table.calculatedDate] }),
    dateIdx: index('idx_metrics_date').on(table.calculatedDate),
  })
);

export const languages = sqliteTable('languages', {
  code: text('code').primaryKey().notNull(),
  nameJa: text('name_ja').notNull(),
  sortOrder: integer('sort_order').notNull().default(100),
});

export type Repository = typeof repositories.$inferSelect;
export type NewRepository = typeof repositories.$inferInsert;
export type RepoSnapshot = typeof repoSnapshots.$inferSelect;
export type NewRepoSnapshot = typeof repoSnapshots.$inferInsert;
export type MetricsDaily = typeof metricsDaily.$inferSelect;
export type NewMetricsDaily = typeof metricsDaily.$inferInsert;
export type Language = typeof languages.$inferSelect;
export type NewLanguage = typeof languages.$inferInsert;
