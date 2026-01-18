/**
 * エラーレスポンスのZodスキーマ定義（ランタイムバリデーション用）
 */
import { z } from 'zod';

/**
 * エラーコード体系
 * - VALIDATION_ERROR: 入力バリデーションエラー
 * - NOT_FOUND: リソースが見つからない
 * - DB_ERROR: データベースエラー
 * - INTERNAL_ERROR: 内部サーバーエラー
 */
export const ErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'DB_ERROR',
  'INTERNAL_ERROR',
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

/**
 * API エラーレスポンススキーマ
 */
export const ApiErrorSchema = z.object({
  error: z.string(),
  code: ErrorCodeSchema.optional(),
  traceId: z.string().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
