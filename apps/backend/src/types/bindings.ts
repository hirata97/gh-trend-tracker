/**
 * Cloudflare Workers バインディング型定義
 */
export type Bindings = {
  DB: D1Database;
  ENVIRONMENT?: string;
  ALLOWED_ORIGINS?: string;
  GITHUB_TOKEN: string;
  INTERNAL_API_TOKEN: string;
  // GitHub OAuth
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  // JWT
  JWT_SECRET: string;
  // OAuth リダイレクトURI（デフォルト: http://localhost:8787/api/auth/callback/github）
  REDIRECT_URI?: string;
  // フロントエンドURL（デフォルト: http://localhost:4321）
  FRONTEND_URL?: string;
  // Stripe
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_PRO?: string;
  STRIPE_PRICE_ENTERPRISE?: string;
  // Sentry
  SENTRY_DSN?: string;
  // Cloudflare Turnstile（Phase 3: Bot対策）
  // テストモード: TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
};
