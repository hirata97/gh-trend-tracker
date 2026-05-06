import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: './wrangler.jsonc',
      },
      miniflare: {
        // wrangler.jsonc の d1_databases が env 以下にのみ定義されているため、
        // デフォルト環境（テスト実行環境）向けに DB バインディングを明示的に追加
        d1Databases: ['DB'],
        bindings: {
          INTERNAL_API_TOKEN: 'test-internal-token',
          GITHUB_CLIENT_ID: 'test-client-id',
          GITHUB_CLIENT_SECRET: 'test-client-secret',
          JWT_SECRET: 'test-jwt-secret-for-testing-only',
          REDIRECT_URI: 'http://localhost:8787/api/auth/callback/github',
          FRONTEND_URL: 'http://localhost:4321',
        },
      },
    }),
  ],
});
