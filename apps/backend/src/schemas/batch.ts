/**
 * バッチAPI関連のZodスキーマ定義（ランタイムバリデーション用）
 */
import { z } from 'zod';

/**
 * バッチAPIリクエストヘッダースキーマ
 * INTERNAL_API_KEYによる認証を要求
 */
export const BatchAuthHeaderSchema = z.object({
  'x-api-key': z.string().min(1, 'API key is required'),
});

export type BatchAuthHeader = z.infer<typeof BatchAuthHeaderSchema>;
