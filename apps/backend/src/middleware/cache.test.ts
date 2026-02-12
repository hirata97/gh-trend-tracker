/**
 * キャッシュミドルウェアのテスト
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { cacheMiddleware } from './cache';

describe('cacheMiddleware', () => {
  it('2xxレスポンスにCache-Controlヘッダーを追加する', async () => {
    const app = new Hono();
    app.use('*', cacheMiddleware(60, 300));
    app.get('/test', (c) => c.json({ message: 'ok' }));

    const res = await app.request('/test');

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(
      'public, max-age=60, stale-while-revalidate=300'
    );
    expect(res.headers.get('CDN-Cache-Control')).toBe('public, max-age=60');
  });

  it('4xxエラーレスポンスにはCache-Controlヘッダーを追加しない', async () => {
    const app = new Hono();
    app.use('*', cacheMiddleware(60, 300));
    app.get('/test', (c) => c.json({ error: 'not found' }, 404));

    const res = await app.request('/test');

    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBeNull();
    expect(res.headers.get('CDN-Cache-Control')).toBeNull();
  });

  it('5xxエラーレスポンスにはCache-Controlヘッダーを追加しない', async () => {
    const app = new Hono();
    app.use('*', cacheMiddleware(60, 300));
    app.get('/test', (c) => c.json({ error: 'server error' }, 500));

    const res = await app.request('/test');

    expect(res.status).toBe(500);
    expect(res.headers.get('Cache-Control')).toBeNull();
    expect(res.headers.get('CDN-Cache-Control')).toBeNull();
  });

  it('カスタムmaxAgeとswrを設定できる', async () => {
    const app = new Hono();
    app.use('*', cacheMiddleware(120, 600));
    app.get('/test', (c) => c.json({ message: 'ok' }));

    const res = await app.request('/test');

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(
      'public, max-age=120, stale-while-revalidate=600'
    );
    expect(res.headers.get('CDN-Cache-Control')).toBe('public, max-age=120');
  });
});
