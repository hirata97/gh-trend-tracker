import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

// registerMiddleware全体を使うとDBミドルウェアの依存が生じるため、
// CORSロジックのみを抽出して単体テストする
function buildCorsMiddleware(env: { ENVIRONMENT?: string; ALLOWED_ORIGINS?: string }) {
  const app = new Hono();
  app.use('/*', async (c, next) => {
    const isProduction = env.ENVIRONMENT === 'production';
    const allowedOrigins =
      env.ALLOWED_ORIGINS?.split(',')
        .map((o) => o.trim())
        .filter(Boolean) ?? [];

    let origin: string | string[];
    if (isProduction && allowedOrigins.length === 0) {
      origin = [];
    } else if (allowedOrigins.length > 0) {
      origin = allowedOrigins;
    } else {
      origin = '*';
    }

    const corsMiddleware = cors({ origin, credentials: true });
    return corsMiddleware(c, next);
  });
  app.get('/test', (c) => c.json({ ok: true }));
  return app;
}

describe('CORSミドルウェア', () => {
  describe('開発環境（ENVIRONMENT未設定）', () => {
    let app: Hono;

    beforeEach(() => {
      app = buildCorsMiddleware({});
    });

    it('任意のオリジンを許可する', async () => {
      const res = await app.request('/test', {
        headers: { Origin: 'http://localhost:4321' },
      });
      expect(res.status).toBe(200);
      // origin:'*' の場合、Honoはリクエストのオリジンをそのまま返す
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:4321');
    });
  });

  describe('開発環境（ENVIRONMENT=development）', () => {
    let app: Hono;

    beforeEach(() => {
      app = buildCorsMiddleware({ ENVIRONMENT: 'development' });
    });

    it('任意のオリジンを許可する', async () => {
      const res = await app.request('/test', {
        headers: { Origin: 'http://localhost:4321' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:4321');
    });
  });

  describe('本番環境（ENVIRONMENT=production、ALLOWED_ORIGINS未設定）', () => {
    let app: Hono;

    beforeEach(() => {
      app = buildCorsMiddleware({ ENVIRONMENT: 'production' });
    });

    it('全オリジンを拒否する（fail-closed）', async () => {
      const res = await app.request('/test', {
        headers: { Origin: 'https://attacker.example.com' },
      });
      expect(res.status).toBe(200);
      // CORSヘッダーが付与されない（オリジンが拒否される）
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
  });

  describe('本番環境（ENVIRONMENT=production、ALLOWED_ORIGINS設定済み）', () => {
    let app: Hono;

    beforeEach(() => {
      app = buildCorsMiddleware({
        ENVIRONMENT: 'production',
        ALLOWED_ORIGINS: 'https://example.com,https://app.example.com',
      });
    });

    it('許可オリジンからのリクエストを通す', async () => {
      const res = await app.request('/test', {
        headers: { Origin: 'https://example.com' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    });

    it('未許可オリジンからのリクエストを拒否する', async () => {
      const res = await app.request('/test', {
        headers: { Origin: 'https://attacker.example.com' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).not.toBe('https://attacker.example.com');
    });
  });

  describe('ALLOWED_ORIGINS設定済み（ENVIRONMENT未設定）', () => {
    let app: Hono;

    beforeEach(() => {
      app = buildCorsMiddleware({
        ALLOWED_ORIGINS: 'https://example.com',
      });
    });

    it('指定オリジンを許可する', async () => {
      const res = await app.request('/test', {
        headers: { Origin: 'https://example.com' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    });
  });

  describe('ALLOWED_ORIGINS スペース除去', () => {
    it('オリジン文字列のスペースをトリムする', async () => {
      const app = buildCorsMiddleware({
        ENVIRONMENT: 'production',
        ALLOWED_ORIGINS: ' https://example.com , https://app.example.com ',
      });
      const res = await app.request('/test', {
        headers: { Origin: 'https://example.com' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    });
  });
});
