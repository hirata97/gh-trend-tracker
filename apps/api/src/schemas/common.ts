/**
 * 共通Zodスキーマ定義（ランタイムバリデーション用）
 */
import { z } from 'zod';

/**
 * リポジトリ情報スキーマ
 */
export const RepositorySchema = z.object({
  repoId: z.number().int().positive(),
  name: z.string(),
  fullName: z.string(),
  owner: z.string(),
  language: z.string().nullable(),
  description: z.string().nullable(),
  htmlUrl: z.string().url(),
  homepage: z.string().nullable().optional(),
  topics: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  pushedAt: z.string().nullable().optional(),
});

/**
 * スナップショット情報スキーマ
 */
export const RepoSnapshotSchema = z.object({
  id: z.number().int().positive(),
  repoId: z.number().int().positive(),
  stars: z.number().int().nonnegative(),
  forks: z.number().int().nonnegative(),
  watchers: z.number().int().nonnegative(),
  openIssues: z.number().int().nonnegative(),
  snapshotDate: z.string(),
  createdAt: z.string(),
});

/**
 * トレンドアイテムスキーマ
 */
export const TrendItemSchema = z.object({
  repoId: z.number().int().positive(),
  name: z.string(),
  fullName: z.string(),
  owner: z.string(),
  language: z.string().nullable(),
  description: z.string().nullable(),
  htmlUrl: z.string().url(),
  currentStars: z.number().int().nullable(),
  snapshotDate: z.string().nullable().optional(),
});
