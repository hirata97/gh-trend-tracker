/**
 * 週別トレンドAPI関連のZodスキーマ定義（ランタイムバリデーション用）
 */
import { z } from 'zod';

/**
 * /api/trends/weekly クエリパラメータスキーマ
 */
export const WeeklyTrendsQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  week: z.coerce.number().int().min(1).max(53),
  language: z.string().max(50, 'Language must be at most 50 characters').optional(),
});

export type WeeklyTrendsQuery = z.infer<typeof WeeklyTrendsQuerySchema>;
