/**
 * POST /api/auth/logout のテスト
 */

import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';

describe('POST /api/auth/logout', () => {
  it('ログアウト成功メッセージを返す', async () => {
    const res = await SELF.fetch('http://example.com/api/auth/logout', {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      message: 'Logged out successfully',
    });
  });

  it('Set-CookieヘッダーでCookieを削除する', async () => {
    const res = await SELF.fetch('http://example.com/api/auth/logout', {
      method: 'POST',
    });

    expect(res.status).toBe(200);

    // Set-Cookieヘッダーを確認
    const setCookieHeader = res.headers.get('Set-Cookie');
    expect(setCookieHeader).toBeTruthy();
    expect(setCookieHeader).toContain('auth_token=');
    expect(setCookieHeader).toContain('Max-Age=0'); // Cookie削除の証拠
  });

  it('GETメソッドでは404エラーを返す', async () => {
    const res = await SELF.fetch('http://example.com/api/auth/logout', {
      method: 'GET',
    });

    expect(res.status).toBe(404);
  });
});
