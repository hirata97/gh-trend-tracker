/**
 * GET /health の統合テスト
 * レスポンス形を assert してAPI契約の後方互換性を保証する
 */

import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';

describe('GET /health', () => {
  it('200 と正しいレスポンス形を返す', async () => {
    const res = await SELF.fetch('http://example.com/health');

    expect(res.status).toBe(200);
    const data = await res.json<Record<string, unknown>>();

    expect(data).toMatchObject({
      status: expect.stringMatching(/^(ok|unhealthy)$/),
      timestamp: expect.any(String),
      database: expect.stringMatching(/^(connected|disconnected)$/),
    });
    expect(() => new Date(data.timestamp as string)).not.toThrow();
  });

  it('Content-Type が application/json', async () => {
    const res = await SELF.fetch('http://example.com/health');
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });
});
