/**
 * GET /api/auth/me のテスト
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { generateJwt } from '../../services/jwt';

describe('GET /api/auth/me', () => {
  beforeAll(async () => {
    // テスト用のテーブルを作成
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

    // テスト用ユーザーを挿入
    await env.DB.prepare(
      `INSERT INTO users (
        id, created_at, updated_at, github_id, username, email, avatar_url, plan, credits_remaining
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        'test-user-id-me',
        new Date().toISOString(),
        new Date().toISOString(),
        123456,
        'testuser',
        'test@example.com',
        'https://avatars.githubusercontent.com/u/123456',
        'FREE',
        100
      )
      .run();
  });

  it('有効なJWTで認証されたユーザー情報を返す', async () => {
    // JWTトークンを生成
    const token = await generateJwt(
      {
        userId: 'test-user-id-me',
        username: 'testuser',
      },
      env.JWT_SECRET,
      { expiresIn: 3600 }
    );

    const res = await SELF.fetch('http://example.com/api/auth/me', {
      headers: {
        Cookie: `auth_token=${token}`,
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      userId: 'test-user-id-me',
      username: 'testuser',
      avatar_url: 'https://avatars.githubusercontent.com/u/123456',
      plan: 'FREE',
    });
  });

  it('認証なしの場合は401を返す', async () => {
    const res = await SELF.fetch('http://example.com/api/auth/me');

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toHaveProperty('error');
  });

  it('無効なJWTの場合は401を返す', async () => {
    const res = await SELF.fetch('http://example.com/api/auth/me', {
      headers: {
        Cookie: 'auth_token=invalid-token',
      },
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toHaveProperty('error');
  });

  it('存在しないユーザーIDの場合は404を返す', async () => {
    // 存在しないユーザーIDでJWTを生成
    const token = await generateJwt(
      {
        userId: 'non-existent-user-id',
        username: 'nonexistent',
      },
      env.JWT_SECRET,
      { expiresIn: 3600 }
    );

    const res = await SELF.fetch('http://example.com/api/auth/me', {
      headers: {
        Cookie: `auth_token=${token}`,
      },
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data).toMatchObject({
      error: 'User not found',
    });
  });
});
