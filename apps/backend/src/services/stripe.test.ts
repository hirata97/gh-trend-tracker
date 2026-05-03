/**
 * Stripeサービスのテスト
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { activateUserPlan, deactivateUserPlan } from './stripe';

describe('activateUserPlan', () => {
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
        stripe_customer_id TEXT UNIQUE,
        subscription_expires_at TEXT
      )
    `).run();

    await env.DB.prepare(
      `INSERT OR IGNORE INTO users (
        id, created_at, updated_at, github_id, username, plan, credits_remaining
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        'stripe-service-test-user',
        new Date().toISOString(),
        new Date().toISOString(),
        999003,
        'stripeserviceuser',
        'FREE',
        0
      )
      .run();
  });

  it('ユーザーのプランをPROに更新する', async () => {
    const db = drizzle(env.DB);

    await activateUserPlan(db, 'stripe-service-test-user', 'PRO', 'cus_test_123');

    const result = await env.DB.prepare(
      'SELECT plan, stripe_customer_id, subscription_expires_at FROM users WHERE id = ?'
    )
      .bind('stripe-service-test-user')
      .first<{ plan: string; stripe_customer_id: string; subscription_expires_at: string }>();

    expect(result).not.toBeNull();
    expect(result?.plan).toBe('PRO');
    expect(result?.stripe_customer_id).toBe('cus_test_123');
    expect(result?.subscription_expires_at).toBeTruthy();
  });

  it('deactivateUserPlanでFREEプランに戻す', async () => {
    const db = drizzle(env.DB);

    await deactivateUserPlan(db, 'cus_test_123');

    const result = await env.DB.prepare(
      'SELECT plan, subscription_expires_at FROM users WHERE id = ?'
    )
      .bind('stripe-service-test-user')
      .first<{ plan: string; subscription_expires_at: string | null }>();

    expect(result).not.toBeNull();
    expect(result?.plan).toBe('FREE');
    expect(result?.subscription_expires_at).toBeNull();
  });
});
