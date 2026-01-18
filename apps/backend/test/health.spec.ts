import { SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

describe('Health endpoint', () => {
  it('GET /health returns status ok with database connected', async () => {
    const response = await SELF.fetch('http://example.com/health');
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('status', 'ok');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('database', 'connected');
  });
});
