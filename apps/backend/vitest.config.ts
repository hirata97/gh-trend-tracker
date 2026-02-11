import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: {
            INTERNAL_API_TOKEN: 'test-internal-token',
            GITHUB_CLIENT_ID: 'test-client-id',
            GITHUB_CLIENT_SECRET: 'test-client-secret',
            JWT_SECRET: 'test-jwt-secret-for-testing-only',
            REDIRECT_URI: 'http://localhost:8787/api/auth/callback/github',
            FRONTEND_URL: 'http://localhost:4321',
          },
        },
      },
    },
  },
});
