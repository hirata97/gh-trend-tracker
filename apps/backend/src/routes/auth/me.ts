/**
 * GET /api/auth/me
 * ログイン中のユーザー情報を取得
 * Related: fun-030 (GitHub OAuth認証)
 */

import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth';
import { findUserById } from '../../services/user-service';
import type { AppEnv } from '../../types/app';
import type { AuthVariables } from '../../middleware/auth';

const app = new Hono<AppEnv & { Variables: AuthVariables }>();

/**
 * 現在のユーザー情報を取得
 * 認証が必要
 */
app.get('/', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');

  try {
    // データベースから最新のユーザー情報を取得
    const userInfo = await findUserById(db, user.userId);

    if (!userInfo) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      userId: userInfo.id,
      username: userInfo.username,
      avatar_url: userInfo.avatarUrl,
      plan: userInfo.plan,
    });
  } catch (error) {
    console.error('Failed to get user info:', error);
    return c.json({ error: 'Failed to get user info' }, 500);
  }
});

export default app;
