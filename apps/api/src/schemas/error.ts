/**
 * エラーレスポンスのZodスキーマ定義
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
  error: z.string().openapi({
    description: 'エラーメッセージ',
    example: 'Failed to fetch trends',
  }),
  code: ErrorCodeSchema.optional().openapi({
    description: 'エラーコード',
    example: 'DB_ERROR',
  }),
  traceId: z.string().optional().openapi({
    description: 'トレース用ID（デバッグ用）',
    example: 'abc123-def456',
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
