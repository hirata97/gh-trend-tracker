/**
 * Sentry初期化ユーティリティ（Cloudflare Workers向け）
 * マスキング処理でトークン・個人情報の流出を防ぐ
 */
import type { ErrorEvent, EventHint } from '@sentry/cloudflare';

const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const MASKED_EMAIL = '***@***.***';

/**
 * Sentryイベントから機密情報をマスキングする
 *
 * 対象:
 * - Authorizationヘッダー
 * - 環境変数値（GITHUB_TOKEN / INTERNAL_API_TOKEN）
 * - メールアドレス（Phase 3前準備）
 */
export function maskSensitiveData(
  event: ErrorEvent,
  sensitiveValues: string[],
  _hint?: EventHint
): ErrorEvent | null {
  const serialized = JSON.stringify(event);
  let masked = serialized;

  // Authorizationヘッダーをマスク（Bearer token等）
  masked = masked.replace(/"Authorization"\s*:\s*"[^"]*"/g, '"Authorization":"[MASKED]"');
  masked = masked.replace(/"authorization"\s*:\s*"[^"]*"/g, '"authorization":"[MASKED]"');

  // 環境変数値（GITHUB_TOKEN / INTERNAL_API_TOKEN）をマスク
  for (const value of sensitiveValues) {
    if (value && value.length > 0) {
      // 正規表現のメタ文字をエスケープ
      const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      masked = masked.replace(new RegExp(escaped, 'g'), '[MASKED]');
    }
  }

  // メールアドレスをマスク
  masked = masked.replace(EMAIL_PATTERN, MASKED_EMAIL);

  return JSON.parse(masked) as ErrorEvent;
}

/**
 * Sentry用のbeforeSendフックを生成する
 * 環境変数からマスク対象の値を動的に取得する
 */
export function createBeforeSend(env: { GITHUB_TOKEN?: string; INTERNAL_API_TOKEN?: string }) {
  return (event: ErrorEvent, hint?: EventHint): ErrorEvent | null => {
    const sensitiveValues = [env.GITHUB_TOKEN, env.INTERNAL_API_TOKEN].filter(
      (v): v is string => typeof v === 'string' && v.length > 0
    );
    return maskSensitiveData(event, sensitiveValues, hint);
  };
}

/**
 * Sentry設定オブジェクトを生成する
 * withSentryの第1引数として渡す
 */
export function createSentryConfig(env: {
  SENTRY_DSN?: string;
  ENVIRONMENT?: string;
  GITHUB_TOKEN?: string;
  INTERNAL_API_TOKEN?: string;
}) {
  return {
    dsn: env.SENTRY_DSN,
    environment: env.ENVIRONMENT ?? 'development',
    // traceIdをタグに含める（loggingMiddlewareと連携）
    initialScope: {
      tags: { runtime: 'cloudflare-workers' },
    },
    beforeSend: createBeforeSend(env),
  };
}
