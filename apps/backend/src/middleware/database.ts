/**
 * データベースミドルウェア
 * リクエストごとにDrizzleインスタンスを一度だけ生成し、コンテキストに保存する
 */
import { createMiddleware } from 'hono/factory';
import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { Bindings } from '../types/bindings';

export type Variables = {
  db: DrizzleD1Database;
};

export const dbMiddleware = createMiddleware<{
  Bindings: Bindings;
  Variables: Variables;
}>(async (c, next) => {
  c.set('db', drizzle(c.env.DB));
  await next();
});
