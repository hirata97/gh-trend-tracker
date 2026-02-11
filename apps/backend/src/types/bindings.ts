/**
 * Cloudflare Workers バインディング型定義
 */
export type Bindings = {
  DB: D1Database;
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
};
