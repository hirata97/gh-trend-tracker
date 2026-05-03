/**
 * リポジトリAPI関連のZodスキーマ定義（ランタイムバリデーション用）
 */
import { z } from 'zod';

/**
 * リポジトリIDのパラメータスキーマ
 */
export const RepoIdParamSchema = z.object({
  repoId: z.coerce.number().int().positive(),
});

export type RepoIdParam = z.infer<typeof RepoIdParamSchema>;
