/**
 * Cloudflare Turnstile トークン検証ミドルウェア
 *
 * Phase 3（GitHub OAuth ログイン）で適用予定。
 * 現時点では未適用（Phase 2 末時点での準備のみ）。
 *
 * 使用方法（Phase 3で適用する際）:
 *   import { verifyTurnstile } from '../middleware/turnstile';
 *   app.use('/api/auth/login/github', verifyTurnstile);
 *
 * リクエストから Turnstile トークンを取得する方法:
 *   - Request header: `CF-Turnstile-Token`
 *   - または JSON body の `cf_turnstile_response` フィールド
 *
 * 環境変数:
 *   - `TURNSTILE_SECRET_KEY`: Cloudflare ダッシュボードで発行したシークレットキー
 *   - テストモード: シークレットキーを 1x0000000000000000000000000000000AA に設定
 *
 * 参考: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

import type { Context, Next } from 'hono';
import { logger } from '../utils/logger';
import type { AppEnv } from '../types/app';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

/**
 * リクエストから Turnstile トークンを抽出する
 * ヘッダー優先、なければ JSON body を参照する
 */
async function extractToken(c: Context): Promise<string | null> {
  const headerToken = c.req.header('CF-Turnstile-Token');
  if (headerToken) return headerToken;

  try {
    const contentType = c.req.header('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const body = await c.req.json<Record<string, unknown>>();
      const token = body?.cf_turnstile_response;
      if (typeof token === 'string') return token;
    }
  } catch {
    // ボディのパース失敗は無視（ヘッダーにトークンがなかった場合のみ到達）
  }

  return null;
}

/**
 * Turnstile トークン検証ミドルウェア
 *
 * TURNSTILE_SECRET_KEY が未設定の場合はスキップする（開発環境向け）。
 * 本番環境では必ず設定すること。
 */
export async function verifyTurnstile(c: Context<AppEnv>, next: Next): Promise<Response | void> {
  const secretKey = c.env.TURNSTILE_SECRET_KEY;

  // シークレットキー未設定時はスキップ（開発環境・テスト環境向け）
  if (!secretKey) {
    logger.warn('turnstile_skip', { reason: 'TURNSTILE_SECRET_KEY が未設定です' });
    return next();
  }

  const token = await extractToken(c);

  if (!token) {
    logger.warn('turnstile_token_missing', { path: c.req.path });
    return c.json({ error: 'Turnstile token is required', code: 'TURNSTILE_MISSING' }, 403);
  }

  // クライアント IP を取得（Cloudflare Workers では CF-Connecting-IP が信頼できる）
  const clientIp = c.req.header('CF-Connecting-IP') ?? 'unknown';

  try {
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    formData.append('remoteip', clientIp);

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      logger.error('turnstile_api_error', {
        status: response.status,
        path: c.req.path,
      });
      return c.json({ error: 'Bot verification service unavailable', code: 'TURNSTILE_ERROR' }, 503);
    }

    const result = (await response.json()) as TurnstileVerifyResponse;

    if (!result.success) {
      logger.warn('turnstile_verify_failed', {
        errorCodes: result['error-codes'],
        path: c.req.path,
      });
      return c.json({ error: 'Bot verification failed', code: 'TURNSTILE_INVALID' }, 403);
    }

    logger.info('turnstile_verify_success', { path: c.req.path });
    return next();
  } catch (error) {
    logger.error('turnstile_fetch_failed', {
      errorMessage: error instanceof Error ? error.message : 'unknown',
      path: c.req.path,
    });
    return c.json({ error: 'Bot verification service unavailable', code: 'TURNSTILE_ERROR' }, 503);
  }
}
