/**
 * GitHub OAuth認証開始エンドポイントのテスト
 */

import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';

describe('GET /api/auth/login/github', () => {
  it('GitHub OAuth認証URLにリダイレクトする', async () => {
    const response = await SELF.fetch('http://example.com/api/auth/login/github', {
      redirect: 'manual',
    });

    expect(response.status).toBe(302);

    const location = response.headers.get('Location');
    expect(location).toBeDefined();
    expect(location).toContain('https://github.com/login/oauth/authorize');
    expect(location).toContain('client_id=test-client-id');
    expect(location).toContain('redirect_uri=');
    // URLエンコードされているため %3A (コロン) を確認
    expect(location).toContain('scope=read%3Auser');
    expect(location).toContain('state=');

    // StateがCookieに設定されることを確認
    const setCookie = response.headers.get('Set-Cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('oauth_state=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
  });
});
