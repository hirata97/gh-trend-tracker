import { defineConfig } from 'drizzle-kit';

// Drizzle Kit 設定（SQLite/D1用）
// マイグレーション生成: npm run db:generate
// 生成されたSQLは wrangler d1 migrations apply で適用する
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
});
