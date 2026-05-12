/**
 * Sentryクライアントサイド設定
 * ブラウザで発生するJSエラーを収集する
 */
import * as Sentry from '@sentry/astro';

const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

Sentry.init({
  dsn: import.meta.env.PUBLIC_SENTRY_DSN,
  environment: import.meta.env.PUBLIC_ENVIRONMENT ?? 'development',
  // パフォーマンストレースのサンプリングレート（本番は0.1程度に調整）
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  beforeSend(event) {
    const serialized = JSON.stringify(event);

    // Authorizationヘッダーをマスク
    let masked = serialized.replace(
      /"[Aa]uthorization"\s*:\s*"[^"]*"/g,
      '"Authorization":"[MASKED]"'
    );

    // メールアドレスをマスク（Phase 3前準備）
    masked = masked.replace(EMAIL_PATTERN, '***@***.***');

    return JSON.parse(masked);
  },
});
