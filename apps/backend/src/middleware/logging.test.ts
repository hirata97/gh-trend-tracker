import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { loggingMiddleware } from './logging';
import { logger } from '../utils/logger';

describe('loggingMiddleware', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.use('/*', loggingMiddleware);
    app.get('/api/test', (c) => c.json({ ok: true }));
    app.get('/api/bad-request', (c) => c.json({ error: 'bad' }, 400));
    app.get('/api/server-error', (c) => c.json({ error: 'server' }, 500));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('200レスポンス時にinfoログが出力される', async () => {
    const res = await app.request('/api/test');
    expect(res.status).toBe(200);
    expect(logger.info).toHaveBeenCalledOnce();
    const [message, fields] = (logger.info as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(message).toBe('api_request');
    expect(fields.method).toBe('GET');
    expect(fields.path).toBe('/api/test');
    expect(fields.status).toBe(200);
    expect(typeof fields.duration_ms).toBe('number');
  });

  it('400レスポンス時にwarnログが出力される', async () => {
    const res = await app.request('/api/bad-request');
    expect(res.status).toBe(400);
    expect(logger.warn).toHaveBeenCalledOnce();
    const [message, fields] = (logger.warn as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(message).toBe('api_request');
    expect(fields.status).toBe(400);
  });

  it('500レスポンス時にerrorログが出力される', async () => {
    const res = await app.request('/api/server-error');
    expect(res.status).toBe(500);
    expect(logger.error).toHaveBeenCalledOnce();
    const [message, fields] = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(message).toBe('api_request');
    expect(fields.status).toBe(500);
  });
});
