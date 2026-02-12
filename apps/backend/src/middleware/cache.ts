/**
 * キャッシュミドルウェア
 * Cloudflare Cache APIとブラウザキャッシュを最適化
 */

import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../types/app';

/**
 * Cache-Controlヘッダーを設定するミドルウェア
 *
 * stale-while-revalidate戦略:
 * - maxAge: ブラウザキャッシュの有効期限
 * - swr: stale-while-revalidate の期間（古いキャッシュを返しつつバックグラウンドで更新）
 */
export const cacheMiddleware = (
  maxAge: number = 60,
  swr: number = 300
) =>
  createMiddleware<AppEnv>(async (c, next) => {
    await next();

    // 成功レスポンス（2xx）の場合のみキャッシュヘッダーを追加
    if (c.res.status >= 200 && c.res.status < 300) {
      c.header(
        'Cache-Control',
        `public, max-age=${maxAge}, stale-while-revalidate=${swr}`
      );
      // Cloudflare CDNにもキャッシュさせる
      c.header('CDN-Cache-Control', `public, max-age=${maxAge}`);
    }
  });
