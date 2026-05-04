/**
 * GitHub認証サービスのテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateAuthUrl, exchangeCodeForToken, fetchGitHubUser, generateState } from './github-auth';

describe('GitHub Auth Service', () => {
  describe('generateAuthUrl', () => {
    it('正しいGitHub OAuth URLを生成できる', () => {
      const clientId = 'test-client-id';
      const redirectUri = 'http://localhost:8787/api/auth/callback/github';
      const state = 'random-state-string';

      const url = generateAuthUrl(clientId, redirectUri, state);

      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain(`client_id=${clientId}`);
      expect(url).toContain(`redirect_uri=${encodeURIComponent(redirectUri)}`);
      expect(url).toContain(`state=${state}`);
      expect(url).toContain('scope=read%3Auser+user%3Aemail');
    });

    it('URLSearchParamsによりパラメータが正しくエンコードされる', () => {
      const clientId = 'my-client-id';
      const redirectUri = 'https://example.com/callback?foo=bar';
      const state = 'abc123';

      const url = generateAuthUrl(clientId, redirectUri, state);
      const parsed = new URL(url);

      expect(parsed.searchParams.get('client_id')).toBe(clientId);
      expect(parsed.searchParams.get('redirect_uri')).toBe(redirectUri);
      expect(parsed.searchParams.get('state')).toBe(state);
      expect(parsed.searchParams.get('scope')).toBe('read:user user:email');
    });
  });

  describe('generateState', () => {
    it('64文字の16進数文字列を生成する', () => {
      const state = generateState();

      expect(state).toHaveLength(64);
      expect(state).toMatch(/^[0-9a-f]+$/);
    });

    it('呼び出し毎に異なる値を返す', () => {
      const state1 = generateState();
      const state2 = generateState();

      expect(state1).not.toBe(state2);
    });
  });

  describe('exchangeCodeForToken', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('GitHubからアクセストークンを取得できる', async () => {
      const mockToken = 'gho_mock_access_token';
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ access_token: mockToken, token_type: 'bearer', scope: 'read:user' }),
        })
      );

      const token = await exchangeCodeForToken('code', 'client-id', 'client-secret', 'http://localhost/callback');

      expect(token).toBe(mockToken);
    });

    it('GitHubへのリクエストが正しいパラメータで送られる', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'token' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await exchangeCodeForToken('auth-code', 'client-id', 'client-secret', 'http://localhost/callback');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://github.com/login/oauth/access_token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Accept: 'application/json',
          }),
          body: JSON.stringify({
            client_id: 'client-id',
            client_secret: 'client-secret',
            code: 'auth-code',
            redirect_uri: 'http://localhost/callback',
          }),
        })
      );
    });

    it('HTTPエラー時に例外をスローする', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          statusText: 'Bad Request',
        })
      );

      await expect(exchangeCodeForToken('code', 'client-id', 'client-secret', 'http://localhost/callback')).rejects.toThrow(
        'GitHub token exchange failed: Bad Request'
      );
    });

    it('access_tokenがない場合に例外をスローする', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ error: 'bad_verification_code' }),
        })
      );

      await expect(exchangeCodeForToken('bad-code', 'client-id', 'client-secret', 'http://localhost/callback')).rejects.toThrow(
        'No access token received from GitHub'
      );
    });
  });

  describe('fetchGitHubUser', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('GitHubユーザー情報を取得できる', async () => {
      const mockUser = {
        id: 12345,
        login: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
      };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => mockUser,
        })
      );

      const user = await fetchGitHubUser('gho_test_token');

      expect(user.id).toBe(mockUser.id);
      expect(user.login).toBe(mockUser.login);
      expect(user.email).toBe(mockUser.email);
    });

    it('AuthorizationヘッダーにBearerトークンが含まれる', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 1, login: 'user' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await fetchGitHubUser('gho_test_token');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer gho_test_token',
          }),
        })
      );
    });

    it('HTTPエラー時に例外をスローする', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          statusText: 'Unauthorized',
        })
      );

      await expect(fetchGitHubUser('invalid-token')).rejects.toThrow('GitHub user fetch failed: Unauthorized');
    });
  });
});
