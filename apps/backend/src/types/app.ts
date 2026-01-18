/**
 * Honoアプリケーション共通型定義
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { Bindings } from './bindings';

export type Variables = {
  db: DrizzleD1Database;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
