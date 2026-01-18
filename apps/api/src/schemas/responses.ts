/**
 * APIレスポンスのZodスキーマ定義
 */
import { z } from 'zod';
import { TrendItemSchema, RepoSnapshotSchema } from './common';

/**
 * ヘルスチェックレスポンススキーマ
 */
export const HealthResponseSchema = z.object({
  status: z.string().openapi({
    description: 'サービスの状態',
    example: 'ok',
  }),
  timestamp: z.string().openapi({
    description: '現在のタイムスタンプ（ISO 8601形式）',
    example: '2026-01-17T12:00:00.000Z',
  }),
});

/**
 * トレンドレスポンススキーマ
 */
export const TrendsResponseSchema = z.object({
  language: z.string().optional().openapi({
    description: '言語フィルター（指定された場合）',
    example: 'JavaScript',
  }),
  trends: z.array(TrendItemSchema).openapi({
    description: 'トレンドリポジトリのリスト',
  }),
});

/**
 * 履歴レスポンススキーマ
 */
export const HistoryResponseSchema = z.object({
  history: z.array(RepoSnapshotSchema).openapi({
    description: 'リポジトリの過去スナップショットリスト',
  }),
});

/**
 * 言語一覧レスポンススキーマ
 */
export const LanguagesResponseSchema = z.object({
  languages: z.array(z.string().nullable()).openapi({
    description: '利用可能な言語のリスト',
    example: ['JavaScript', 'TypeScript', 'Python', 'Go', null],
  }),
});
