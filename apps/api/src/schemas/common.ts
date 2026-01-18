/**
 * 共通Zodスキーマ定義
 */
import { z } from 'zod';

/**
 * リポジトリ情報スキーマ
 */
export const RepositorySchema = z.object({
  repoId: z.number().int().positive().openapi({
    description: 'リポジトリID',
    example: 1,
  }),
  name: z.string().openapi({
    description: 'リポジトリ名',
    example: 'react',
  }),
  fullName: z.string().openapi({
    description: 'フルリポジトリ名（owner/name形式）',
    example: 'facebook/react',
  }),
  owner: z.string().openapi({
    description: 'オーナー名',
    example: 'facebook',
  }),
  language: z.string().nullable().openapi({
    description: '主要プログラミング言語',
    example: 'JavaScript',
  }),
  description: z.string().nullable().openapi({
    description: 'リポジトリの説明',
    example: 'A declarative, efficient, and flexible JavaScript library for building user interfaces.',
  }),
  htmlUrl: z.string().url().openapi({
    description: 'GitHubリポジトリURL',
    example: 'https://github.com/facebook/react',
  }),
  homepage: z.string().nullable().optional().openapi({
    description: 'ホームページURL',
    example: 'https://reactjs.org',
  }),
  topics: z.string().nullable().optional().openapi({
    description: 'トピックのJSON文字列',
    example: '["javascript","react","frontend"]',
  }),
  createdAt: z.string().optional().openapi({
    description: '作成日時（ISO 8601形式）',
    example: '2013-05-24T16:15:54Z',
  }),
  updatedAt: z.string().optional().openapi({
    description: '更新日時（ISO 8601形式）',
    example: '2026-01-17T12:00:00Z',
  }),
  pushedAt: z.string().nullable().optional().openapi({
    description: '最終プッシュ日時（ISO 8601形式）',
    example: '2026-01-17T10:30:00Z',
  }),
});

/**
 * スナップショット情報スキーマ
 */
export const RepoSnapshotSchema = z.object({
  id: z.number().int().positive().openapi({
    description: 'スナップショットID',
    example: 1,
  }),
  repoId: z.number().int().positive().openapi({
    description: 'リポジトリID',
    example: 1,
  }),
  stars: z.number().int().nonnegative().openapi({
    description: 'スター数',
    example: 230000,
  }),
  forks: z.number().int().nonnegative().openapi({
    description: 'フォーク数',
    example: 47000,
  }),
  watchers: z.number().int().nonnegative().openapi({
    description: 'ウォッチャー数',
    example: 6700,
  }),
  openIssues: z.number().int().nonnegative().openapi({
    description: 'オープンなIssue数',
    example: 1200,
  }),
  snapshotDate: z.string().openapi({
    description: 'スナップショット日付（YYYY-MM-DD形式）',
    example: '2026-01-17',
  }),
  createdAt: z.string().openapi({
    description: '作成日時（ISO 8601形式）',
    example: '2026-01-17T00:00:00Z',
  }),
});

/**
 * トレンドアイテムスキーマ
 */
export const TrendItemSchema = z.object({
  repoId: z.number().int().positive().openapi({
    description: 'リポジトリID',
    example: 1,
  }),
  name: z.string().openapi({
    description: 'リポジトリ名',
    example: 'react',
  }),
  fullName: z.string().openapi({
    description: 'フルリポジトリ名',
    example: 'facebook/react',
  }),
  owner: z.string().openapi({
    description: 'オーナー名',
    example: 'facebook',
  }),
  language: z.string().nullable().openapi({
    description: '主要プログラミング言語',
    example: 'JavaScript',
  }),
  description: z.string().nullable().openapi({
    description: 'リポジトリの説明',
    example: 'A declarative, efficient, and flexible JavaScript library for building user interfaces.',
  }),
  htmlUrl: z.string().url().openapi({
    description: 'GitHubリポジトリURL',
    example: 'https://github.com/facebook/react',
  }),
  currentStars: z.number().int().nullable().openapi({
    description: '現在のスター数（スナップショットがない場合はnull）',
    example: 230000,
  }),
  snapshotDate: z.string().nullable().optional().openapi({
    description: 'スナップショット日付',
    example: '2026-01-17',
  }),
});
