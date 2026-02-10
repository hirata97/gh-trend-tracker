/**
 * Cloudflare Workers バインディング型定義
 */
export type Bindings = {
  DB: D1Database;
  ALLOWED_ORIGINS?: string;
  GITHUB_TOKEN: string;
  INTERNAL_API_TOKEN: string;
};
