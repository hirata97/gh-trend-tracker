/**
 * ユーザーサービス
 */

import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { users } from '../db/schema';
import type { User, NewUser } from '../db/schema';

/**
 * UUIDを生成する
 *
 * @returns UUID文字列
 */
function generateUuid(): string {
  return crypto.randomUUID();
}

/**
 * GitHubIDでユーザーを検索する
 *
 * @param db - Drizzle DBインスタンス
 * @param githubId - GitHubユーザーID
 * @returns ユーザー情報（存在しない場合はnull）
 */
export async function findUserByGitHubId(
  db: DrizzleD1Database,
  githubId: number
): Promise<User | null> {
  const result = await db.select().from(users).where(eq(users.githubId, githubId)).limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * ユーザーIDでユーザーを検索する
 *
 * @param db - Drizzle DBインスタンス
 * @param userId - ユーザーID（UUID）
 * @returns ユーザー情報（存在しない場合はnull）
 */
export async function findUserById(
  db: DrizzleD1Database,
  userId: string
): Promise<User | null> {
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * 新規ユーザーを登録する
 *
 * @param db - Drizzle DBインスタンス
 * @param githubId - GitHubユーザーID
 * @param username - GitHubユーザー名
 * @param email - メールアドレス（オプション）
 * @param avatarUrl - アバターURL（オプション）
 * @returns 作成されたユーザー情報
 */
export async function createUser(
  db: DrizzleD1Database,
  githubId: number,
  username: string,
  email?: string | null,
  avatarUrl?: string | null
): Promise<User> {
  const newUser: NewUser = {
    id: generateUuid(),
    githubId,
    username,
    email: email ?? undefined,
    avatarUrl: avatarUrl ?? undefined,
    plan: 'FREE',
    creditsRemaining: 0,
  };

  await db.insert(users).values(newUser).run();

  // 挿入したユーザーを取得して返す
  const insertedUser = await findUserByGitHubId(db, githubId);
  if (!insertedUser) {
    throw new Error('Failed to retrieve created user');
  }

  return insertedUser;
}

/**
 * 既存ユーザー情報を更新する
 *
 * @param db - Drizzle DBインスタンス
 * @param githubId - GitHubユーザーID
 * @param username - GitHubユーザー名
 * @param email - メールアドレス（オプション）
 * @param avatarUrl - アバターURL（オプション）
 * @returns 更新されたユーザー情報
 */
export async function updateUser(
  db: DrizzleD1Database,
  githubId: number,
  username: string,
  email?: string | null,
  avatarUrl?: string | null
): Promise<User> {
  await db
    .update(users)
    .set({
      username,
      email: email ?? undefined,
      avatarUrl: avatarUrl ?? undefined,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.githubId, githubId))
    .run();

  // 更新したユーザーを取得して返す
  const updatedUser = await findUserByGitHubId(db, githubId);
  if (!updatedUser) {
    throw new Error('Failed to retrieve updated user');
  }

  return updatedUser;
}

/**
 * ユーザーを登録または更新する
 *
 * @param db - Drizzle DBインスタンス
 * @param githubId - GitHubユーザーID
 * @param username - GitHubユーザー名
 * @param email - メールアドレス（オプション）
 * @param avatarUrl - アバターURL（オプション）
 * @returns ユーザー情報
 */
export async function upsertUser(
  db: DrizzleD1Database,
  githubId: number,
  username: string,
  email?: string | null,
  avatarUrl?: string | null
): Promise<User> {
  const existingUser = await findUserByGitHubId(db, githubId);

  if (existingUser) {
    return await updateUser(db, githubId, username, email, avatarUrl);
  } else {
    return await createUser(db, githubId, username, email, avatarUrl);
  }
}
