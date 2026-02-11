/**
 * 検索API関連のZodスキーマ定義（ランタイムバリデーション用）
 */
import { z } from 'zod';

/**
 * /api/repositories/search クエリパラメータスキーマ
 */
export const SearchQuerySchema = z.object({
  query: z.string().min(2, 'Query must be at least 2 characters'),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;
