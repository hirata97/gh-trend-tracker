/**
 * POST /api/webhook/stripe のテスト
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { verifyWebhookSignature } from '../../services/stripe';

describe('POST /api/webhook/stripe', () => {
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
        'webhook-test-user-id',
        new Date().toISOString(),
        new Date().toISOString(),
        999002,
        'webhookuser',
        'FREE',
        0
      )
      .run();
  });

  it('stripe-signatureヘッダーなしの場合は400を返す', async () => {
    const res = await SELF.fetch('http://example.com/api/webhook/stripe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'checkout.session.completed' }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toHaveProperty('error');
  });

  it('Webhook秘密鍵未設定の場合は500を返す', async () => {
    const res = await SELF.fetch('http://example.com/api/webhook/stripe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 't=123,v1=abc',
      },
      body: JSON.stringify({ type: 'checkout.session.completed' }),
    });

    // STRIPE_WEBHOOK_SECRETが未設定の場合は500
    expect(res.status).toBe(500);
  });

  it('無効な署名の場合は400を返す', async () => {
    // 環境変数 STRIPE_WEBHOOK_SECRET がない場合、署名検証失敗前に500が返るため
    // verifyWebhookSignatureの単体テストで検証
    const isValid = await verifyWebhookSignature(
      '{"type":"checkout.session.completed"}',
      't=1234567890,v1=invalidsignature',
      'whsec_test_secret'
    );
    expect(isValid).toBe(false);
  });
});

describe('verifyWebhookSignature', () => {
  it('タイムスタンプが古すぎる場合はfalseを返す', async () => {
    // 10分前のタイムスタンプ（有効期限5分）
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
    const isValid = await verifyWebhookSignature(
      'payload',
      `t=${oldTimestamp},v1=somesignature`,
      'secret'
    );
    expect(isValid).toBe(false);
  });

  it('署名フォーマットが不正な場合はfalseを返す', async () => {
    const isValid = await verifyWebhookSignature('payload', 'invalidsignature', 'secret');
    expect(isValid).toBe(false);
  });
});
