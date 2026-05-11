/**
 * Sentry クライアントサイド設定
 * ブラウザ上で発生したエラーを収集する
 */
import * as Sentry from '@sentry/astro';

const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

Sentry.init({
  dsn: import.meta.env.PUBLIC_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
  sendDefaultPii: false,
  beforeSend(event) {
    // Authorizationヘッダーを除去
    if (event.request?.headers) {
      const headers = { ...event.request.headers } as Record<string, string>;
      delete headers['authorization'];
      delete headers['Authorization'];
      event.request.headers = headers;
    }
    // メールアドレスをマスク
    const eventStr = JSON.stringify(event);
    const masked = eventStr.replace(EMAIL_PATTERN, '***@***.***');
    return JSON.parse(masked) as Sentry.ErrorEvent;
  },
});
