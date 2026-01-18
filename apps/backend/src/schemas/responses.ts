/**
 * APIレスポンスのZodスキーマ定義（ランタイムバリデーション用）
 */
import { z } from 'zod';
import { TrendItemSchema, RepoSnapshotSchema } from './common';

/**
 * ヘルスチェックレスポンススキーマ
 */
export const HealthResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
});

/**
 * トレンドレスポンススキーマ
 */
export const TrendsResponseSchema = z.object({
  language: z.string().optional(),
  trends: z.array(TrendItemSchema),
});

/**
 * 履歴レスポンススキーマ
 */
export const HistoryResponseSchema = z.object({
  history: z.array(RepoSnapshotSchema),
});

/**
 * 言語一覧レスポンススキーマ
 */
export const LanguagesResponseSchema = z.object({
  languages: z.array(z.string().nullable()),
});
