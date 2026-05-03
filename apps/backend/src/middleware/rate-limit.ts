/**
 * レート制限ミドルウェア
 * non-008: APIレート制限（100 req/min/IP）
 * req-034: APIレート制限
 */
import type { Context, Next } from 'hono';
import type { AppEnv } from '../types/app';

interface RateLimitStore {
  count: number;
  resetTime: number;
}

// IP アドレスごとのリクエストカウントを保持
const requestStore = new Map<string, RateLimitStore>();

// 定期的に古いエントリをクリーンアップ（メモリリーク防止）
const CLEANUP_INTERVAL = 60 * 1000; // 1分
const MAX_STORE_SIZE = 10000; // 最大エントリ数

let lastCleanup = Date.now();

/**
 * リクエストストアのクリーンアップ
 */
function cleanupStore(): void {
  const now = Date.now();

  // 前回のクリーンアップから間隔が経過していない場合はスキップ
  if (now - lastCleanup < CLEANUP_INTERVAL) {
    return;
  }

  lastCleanup = now;

  // 期限切れのエントリを削除
  for (const [ip, store] of requestStore.entries()) {
    if (now > store.resetTime) {
      requestStore.delete(ip);
    }
  }

  // ストアサイズが上限を超えている場合、古いエントリから削除
  if (requestStore.size > MAX_STORE_SIZE) {
    const entriesToDelete = requestStore.size - MAX_STORE_SIZE;
    let deleted = 0;

    for (const [ip] of requestStore.entries()) {
      if (deleted >= entriesToDelete) break;
      requestStore.delete(ip);
      deleted++;
    }
  }
}

/**
 * レート制限ミドルウェア
 *
 * @param windowMs - ウィンドウ時間（ミリ秒）
 * @param maxRequests - ウィンドウ内の最大リクエスト数
 */
export function rateLimitMiddleware(
  windowMs: number = 60 * 1000, // デフォルト: 1分
  maxRequests: number = 100      // デフォルト: 100リクエスト
) {
  return async (c: Context<AppEnv>, next: Next) => {
    // クリーンアップ実行
    cleanupStore();

    // IPアドレスを取得（Cloudflare経由の場合は CF-Connecting-IP を優先）
    const ip = c.req.header('CF-Connecting-IP') ||
               c.req.header('X-Forwarded-For')?.split(',')[0] ||
               'unknown';

    const now = Date.now();
    const store = requestStore.get(ip);

    if (!store) {
      // 初回リクエスト
      requestStore.set(ip, {
        count: 1,
        resetTime: now + windowMs,
      });
      
      // レート制限ヘッダーを追加
      c.header('X-RateLimit-Limit', String(maxRequests));
      c.header('X-RateLimit-Remaining', String(maxRequests - 1));
      c.header('X-RateLimit-Reset', String(Math.floor((now + windowMs) / 1000)));
      
      return next();
    }

    // ウィンドウ期間が過ぎている場合、リセット
    if (now > store.resetTime) {
      store.count = 1;
      store.resetTime = now + windowMs;
      
      // レート制限ヘッダーを追加
      c.header('X-RateLimit-Limit', String(maxRequests));
      c.header('X-RateLimit-Remaining', String(maxRequests - 1));
      c.header('X-RateLimit-Reset', String(Math.floor(store.resetTime / 1000)));
      
      return next();
    }

    // リクエストカウント増加
    store.count++;

    // レート制限チェック
    if (store.count > maxRequests) {
      const retryAfter = Math.ceil((store.resetTime - now) / 1000);

      c.header('Retry-After', String(retryAfter));
      c.header('X-RateLimit-Limit', String(maxRequests));
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', String(Math.floor(store.resetTime / 1000)));

      return c.json(
        {
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Please retry after ${retryAfter} seconds.`,
        },
        429
      );
    }

    // レート制限ヘッダーを追加
    c.header('X-RateLimit-Limit', String(maxRequests));
    c.header('X-RateLimit-Remaining', String(maxRequests - store.count));
    c.header('X-RateLimit-Reset', String(Math.floor(store.resetTime / 1000)));

    return next();
  };
}
