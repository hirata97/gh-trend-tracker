/**
 * POST /api/billing/checkout のテスト
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { generateJwt } from '../../services/jwt';

describe('POST /api/billing/checkout', () => {
  beforeAll(async () => {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        github_id INTEGER NOT NULL UNIQUE,
        username TEXT NOT NULL,
        email TEXT,
        avatar_url TEXT,
        plan TEXT NOT NULL DEFAULT 'FREE',
        credits_remaining INTEGER NOT NULL DEFAULT 0,
        stripe_customer_id TEXT,
        subscription_expires_at TEXT
      )
    `).run();

    await env.DB.prepare(
      `INSERT OR IGNORE INTO users (
        id, created_at, updated_at, github_id, username, plan, credits_remaining
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        'billing-test-user-id',
        new Date().toISOString(),
        new Date().toISOString(),
        999001,
        'billinguser',
        'FREE',
        0
      )
      .run();
  });

  it('認証なしの場合は401を返す', async () => {
    const res = await SELF.fetch('http://example.com/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'PRO' }),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toHaveProperty('error');
  });

  it('無効なプランの場合は400を返す', async () => {
    const token = await generateJwt(
      { userId: 'billing-test-user-id', username: 'billinguser' },
      env.JWT_SECRET,
      { expiresIn: 3600 }
    );

    const res = await SELF.fetch('http://example.com/api/billing/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `auth_token=${token}`,
      },
      body: JSON.stringify({ plan: 'INVALID' }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toHaveProperty('error');
  });

  it('Stripe未設定の場合は500を返す', async () => {
    const token = await generateJwt(
      { userId: 'billing-test-user-id', username: 'billinguser' },
      env.JWT_SECRET,
      { expiresIn: 3600 }
    );

    // STRIPE_SECRET_KEYが設定されていない場合
    const res = await SELF.fetch('http://example.com/api/billing/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `auth_token=${token}`,
      },
      body: JSON.stringify({ plan: 'PRO' }),
    });

    // Stripe未設定なら500
    expect(res.status).toBe(500);
  });

  it('リクエストボディなしの場合は4xxまたは5xxを返す', async () => {
    const token = await generateJwt(
      { userId: 'billing-test-user-id', username: 'billinguser' },
      env.JWT_SECRET,
      { expiresIn: 3600 }
    );

    const res = await SELF.fetch('http://example.com/api/billing/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `auth_token=${token}`,
      },
      body: 'not-json',
    });

    // Stripe未設定のため500、またはボディ解析エラーで400
    expect(res.status >= 400).toBe(true);
  });
});
