import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: './wrangler.jsonc',
      },
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
    }),
  ],
});
