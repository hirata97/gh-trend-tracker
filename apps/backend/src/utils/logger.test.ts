import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from './logger';

describe('logger', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('info: JSON形式で出力される', () => {
    logger.info('api_request', { method: 'GET', path: '/health', status: 200 });
    expect(consoleSpy.log).toHaveBeenCalledOnce();
    const entry = JSON.parse(consoleSpy.log.mock.calls[0][0] as string);
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('api_request');
    expect(entry.method).toBe('GET');
    expect(entry.status).toBe(200);
    expect(entry.timestamp).toBeDefined();
  });

  it('warn: console.warnに出力される', () => {
    logger.warn('rate_limit', { path: '/api/trends/daily' });
    expect(consoleSpy.warn).toHaveBeenCalledOnce();
    const entry = JSON.parse(consoleSpy.warn.mock.calls[0][0] as string);
    expect(entry.level).toBe('warn');
  });

  it('error: console.errorに出力される', () => {
    logger.error('batch_failed', { batch: 'collect-daily', error: 'timeout' });
    expect(consoleSpy.error).toHaveBeenCalledOnce();
    const entry = JSON.parse(consoleSpy.error.mock.calls[0][0] as string);
    expect(entry.level).toBe('error');
    expect(entry.batch).toBe('collect-daily');
  });

  it('追加フィールドなしで呼び出せる', () => {
    logger.info('simple_message');
    expect(consoleSpy.log).toHaveBeenCalledOnce();
    const entry = JSON.parse(consoleSpy.log.mock.calls[0][0] as string);
    expect(entry.message).toBe('simple_message');
  });
});
