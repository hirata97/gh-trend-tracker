import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { rateLimitMiddleware } from './rate-limit';

describe('rateLimitMiddleware', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    // テスト用に短いウィンドウ時間（1秒）と少ないリクエスト数（3回）を設定
    app.use('/*', rateLimitMiddleware(1000, 3));
    app.get('/test', (c) => c.json({ message: 'success' }));
  });

  it('正常なリクエストを許可する', async () => {
    const res = await app.request('/test', {
      headers: { 'CF-Connecting-IP': '192.168.1.1' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('3');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('2');
  });

  it('レート制限を超えた場合、429エラーを返す', async () => {
    const ip = '192.168.1.2';

    // 3回リクエスト（制限内）
    for (let i = 0; i < 3; i++) {
      const res = await app.request('/test', {
        headers: { 'CF-Connecting-IP': ip },
      });
      expect(res.status).toBe(200);
    }

    // 4回目のリクエスト（制限超過）
    const res = await app.request('/test', {
      headers: { 'CF-Connecting-IP': ip },
    });

    expect(res.status).toBe(429);
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(res.headers.get('Retry-After')).toBeDefined();

    const json = await res.json();
    expect(json.error).toBe('Too Many Requests');
    expect(json.message).toContain('Rate limit exceeded');
  });

  it('異なるIPアドレスは独立してカウントされる', async () => {
    const ip1 = '192.168.1.3';
    const ip2 = '192.168.1.4';

    // IP1で3回リクエスト（制限内）
    for (let i = 0; i < 3; i++) {
      const res = await app.request('/test', {
        headers: { 'CF-Connecting-IP': ip1 },
      });
      expect(res.status).toBe(200);
    }

    // IP2で3回リクエスト（制限内）
    for (let i = 0; i < 3; i++) {
      const res = await app.request('/test', {
        headers: { 'CF-Connecting-IP': ip2 },
      });
      expect(res.status).toBe(200);
    }

    // IP1で4回目のリクエスト（制限超過）
    const res1 = await app.request('/test', {
      headers: { 'CF-Connecting-IP': ip1 },
    });
    expect(res1.status).toBe(429);

    // IP2で4回目のリクエスト（制限超過）
    const res2 = await app.request('/test', {
      headers: { 'CF-Connecting-IP': ip2 },
    });
    expect(res2.status).toBe(429);
  });

  it('ウィンドウ期間後にリセットされる', async () => {
    const ip = '192.168.1.5';

    // 3回リクエスト（制限内）
    for (let i = 0; i < 3; i++) {
      const res = await app.request('/test', {
        headers: { 'CF-Connecting-IP': ip },
      });
      expect(res.status).toBe(200);
    }

    // 4回目のリクエスト（制限超過）
    const res1 = await app.request('/test', {
      headers: { 'CF-Connecting-IP': ip },
    });
    expect(res1.status).toBe(429);

    // 1秒待機（ウィンドウ期間経過）
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // リセット後の1回目のリクエスト（成功）
    const res2 = await app.request('/test', {
      headers: { 'CF-Connecting-IP': ip },
    });
    expect(res2.status).toBe(200);
  });

  it('IPアドレスヘッダーがない場合、unknown として扱う', async () => {
    const res1 = await app.request('/test');
    expect(res1.status).toBe(200);

    const res2 = await app.request('/test');
    expect(res2.status).toBe(200);

    const res3 = await app.request('/test');
    expect(res3.status).toBe(200);

    const res4 = await app.request('/test');
    expect(res4.status).toBe(429);
  });

  it('X-Forwarded-For ヘッダーからIPを取得できる', async () => {
    const res = await app.request('/test', {
      headers: { 'X-Forwarded-For': '203.0.113.1, 198.51.100.1' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('2');
  });
});
