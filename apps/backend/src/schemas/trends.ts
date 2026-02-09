/**
 * トレンドAPI関連のZodスキーマ定義（ランタイムバリデーション用）
 */
import { z } from 'zod';

/**
 * ソート基準
 */
export const TrendsDailySortBySchema = z.enum([
  '7d_increase',
  '30d_increase',
  '7d_rate',
  '30d_rate',
  'total_stars',
]);

export type TrendsDailySortBy = z.infer<typeof TrendsDailySortBySchema>;

/**
 * /api/trends/daily クエリパラメータスキーマ
 */
export const TrendsDailyQuerySchema = z.object({
  language: z.string().optional(),
  sort_by: TrendsDailySortBySchema,
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type TrendsDailyQuery = z.infer<typeof TrendsDailyQuerySchema>;
