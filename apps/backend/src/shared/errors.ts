/**
 * エラーハンドリングユーティリティ
 * OpenAPI仕様書に準拠したエラーレスポンスを生成する
 */
import type { ApiError, ErrorCode } from '@gh-trend-tracker/shared';

/**
 * トレースIDを生成する
 */
function generateTraceId(): string {
  return crypto.randomUUID();
}

/**
 * OpenAPI準拠のエラーレスポンスを生成する
 */
export function createApiError(
  message: string,
  code: ErrorCode,
  traceId?: string
): ApiError {
  return {
    error: message,
    code,
    traceId: traceId ?? generateTraceId(),
  };
}

/**
 * バリデーションエラーを生成する
 */
export function validationError(message: string, traceId?: string): ApiError {
  return createApiError(message, 'VALIDATION_ERROR', traceId);
}

/**
 * Not Foundエラーを生成する
 */
export function notFoundError(message: string, traceId?: string): ApiError {
  return createApiError(message, 'NOT_FOUND', traceId);
}

/**
 * データベースエラーを生成する
 */
export function dbError(message: string, traceId?: string): ApiError {
  return createApiError(message, 'DB_ERROR', traceId);
}

/**
 * 内部エラーを生成する
 */
export function internalError(message: string, traceId?: string): ApiError {
  return createApiError(message, 'INTERNAL_ERROR', traceId);
}
