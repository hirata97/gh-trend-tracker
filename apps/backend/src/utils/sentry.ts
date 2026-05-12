/**
 * Sentry統合ユーティリティ
 * マスキング処理とSentryオプション生成を提供する
 */
import type { ErrorEvent, EventHint } from '@sentry/cloudflare';
import type { Bindings } from '../types/bindings';

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * 文字列中のメールアドレスをマスクする
 */
export function maskEmail(value: string): string {
  return value.replace(EMAIL_PATTERN, '***@***.***');
}

/**
 * 文字列中の機密トークン値をマスクする
 * 既知のトークン値と一致する部分を [MASKED] に置換する
 */
export function maskTokenValues(value: string, sensitiveValues: string[]): string {
  let result = value;
  for (const token of sensitiveValues) {
    if (token && token.length > 0) {
      result = result.split(token).join('[MASKED]');
    }
  }
  return result;
}

/**
 * Sentryイベントのリクエストヘッダーから機密情報を除去する
 */
function scrubRequestHeaders(event: ErrorEvent): ErrorEvent {
  if (!event.request?.headers) return event;

  const headers = { ...event.request.headers } as Record<string, string>;
  // Authorizationヘッダーは送信しない
  delete headers['authorization'];
  delete headers['Authorization'];

  return {
    ...event,
    request: {
      ...event.request,
      headers,
    },
  };
}

/**
 * Sentryイベントの文字列フィールド全体に対してマスク処理を適用する
 */
function maskEventStrings(
  value: unknown,
  sensitiveValues: string[],
): unknown {
  if (typeof value === 'string') {
    return maskEmail(maskTokenValues(value, sensitiveValues));
  }
  if (Array.isArray(value)) {
    return value.map((item) => maskEventStrings(item, sensitiveValues));
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = maskEventStrings(val, sensitiveValues);
    }
    return result;
  }
  return value;
}

/**
 * SentryのbeforeSendフックでマスキング処理を行う
 * - Authorizationヘッダーを除去
 * - GITHUB_TOKEN / INTERNAL_API_TOKEN の値をマスク
 * - メールアドレスを ***@***.*** に変換
 */
export function createBeforeSend(env: Bindings) {
  const sensitiveValues = [
    env.GITHUB_TOKEN,
    env.INTERNAL_API_TOKEN,
    env.JWT_SECRET,
    env.STRIPE_SECRET_KEY,
    env.SENTRY_DSN,
  ].filter((v): v is string => typeof v === 'string' && v.length > 0);

  return (event: ErrorEvent, _hint: EventHint): ErrorEvent | null => {
    let masked = scrubRequestHeaders(event);
    masked = maskEventStrings(masked, sensitiveValues) as ErrorEvent;
    return masked;
  };
}

/**
 * CloudflareバインディングからSentryオプションを生成する
 */
export function buildSentryOptions(env: Bindings) {
  return {
    dsn: env.SENTRY_DSN ?? '',
    environment: env.ENVIRONMENT ?? 'development',
    tracesSampleRate: env.ENVIRONMENT === 'production' ? 0.1 : 0,
    sendDefaultPii: false,
    beforeSend: createBeforeSend(env),
  };
}
