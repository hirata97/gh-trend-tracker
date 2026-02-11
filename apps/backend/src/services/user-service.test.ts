/**
 * ユーザーサービスのテスト
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { findUserByGitHubId, findUserById, createUser, updateUser, upsertUser } from './user-service';

describe('User Service', () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    db = drizzle(env.DB);

    // usersテーブル作成
    await db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        github_id INTEGER UNIQUE NOT NULL,
        username TEXT NOT NULL,
        email TEXT,
        avatar_url TEXT,
        plan TEXT NOT NULL DEFAULT 'FREE',
        credits_remaining INTEGER NOT NULL DEFAULT 0,
        stripe_customer_id TEXT UNIQUE,
        subscription_expires_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  });

  describe('createUser', () => {
    it('新規ユーザーを作成できる', async () => {
      const githubId = 12345;
      const username = 'testuser';
      const email = 'test@example.com';
      const avatarUrl = 'https://example.com/avatar.png';

      const user = await createUser(db, githubId, username, email, avatarUrl);

      expect(user).toBeDefined();
      expect(user.githubId).toBe(githubId);
      expect(user.username).toBe(username);
      expect(user.email).toBe(email);
      expect(user.avatarUrl).toBe(avatarUrl);
      expect(user.plan).toBe('FREE');
      expect(user.creditsRemaining).toBe(0);
    });

    it('emailとavatarUrlなしでユーザーを作成できる', async () => {
      const githubId = 54321;
      const username = 'testuser2';

      const user = await createUser(db, githubId, username);

      expect(user).toBeDefined();
      expect(user.githubId).toBe(githubId);
      expect(user.username).toBe(username);
      // SQLiteではundefinedではなくnullが返る
      expect(user.email).toBeNull();
      expect(user.avatarUrl).toBeNull();
    });
  });

  describe('findUserByGitHubId', () => {
    it('GitHubIDでユーザーを検索できる', async () => {
      const githubId = 99999;
      const username = 'searchtest';
      await createUser(db, githubId, username);

      const found = await findUserByGitHubId(db, githubId);

      expect(found).toBeDefined();
      expect(found?.githubId).toBe(githubId);
      expect(found?.username).toBe(username);
    });

    it('存在しないGitHubIDの場合はnullを返す', async () => {
      const found = await findUserByGitHubId(db, 999999999);

      expect(found).toBeNull();
    });
  });

  describe('findUserById', () => {
    it('ユーザーIDでユーザーを検索できる', async () => {
      const githubId = 88888;
      const username = 'idtest';
      const user = await createUser(db, githubId, username);

      const found = await findUserById(db, user.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(user.id);
      expect(found?.username).toBe(username);
    });

    it('存在しないユーザーIDの場合はnullを返す', async () => {
      const found = await findUserById(db, 'non-existent-uuid');

      expect(found).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('既存ユーザー情報を更新できる', async () => {
      const githubId = 77777;
      const username = 'updatetest';
      await createUser(db, githubId, username);

      const newUsername = 'updated_user';
      const newEmail = 'updated@example.com';
      const updatedUser = await updateUser(db, githubId, newUsername, newEmail);

      expect(updatedUser.githubId).toBe(githubId);
      expect(updatedUser.username).toBe(newUsername);
      expect(updatedUser.email).toBe(newEmail);
    });
  });

  describe('upsertUser', () => {
    it('新規ユーザーの場合は作成する', async () => {
      const githubId = 66666;
      const username = 'upserttest1';

      const user = await upsertUser(db, githubId, username);

      expect(user).toBeDefined();
      expect(user.githubId).toBe(githubId);
      expect(user.username).toBe(username);
    });

    it('既存ユーザーの場合は更新する', async () => {
      const githubId = 55555;
      const username = 'upserttest2';
      await createUser(db, githubId, username);

      const newUsername = 'updated_upsert';
      const user = await upsertUser(db, githubId, newUsername);

      expect(user.githubId).toBe(githubId);
      expect(user.username).toBe(newUsername);
    });
  });
});
