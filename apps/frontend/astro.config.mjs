import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sentry from '@sentry/astro';
import process from 'node:process';

// https://astro.build/config
export default defineConfig({
  integrations: [
    react({
      // Reactコンポーネントの部分ハイドレーション最適化
      include: ['**/components/**'],
    }),
    sentry({
      dsn: process.env.PUBLIC_SENTRY_DSN,
      sourceMapsUploadOptions: {
        project: 'gh-trend-tracker-frontend',
        // SENTRY_AUTH_TOKENはCI環境変数として管理（ローカルでは不要）
        authToken: process.env.SENTRY_AUTH_TOKEN,
      },
    }),
  ],
  output: 'static',
  server: {
    port: 4321,
  },
  build: {
    // インライン化するCSSの最小サイズ（LCP改善）
    inlineStylesheets: 'auto',
  },
  // プリフェッチ設定（ページ遷移高速化）
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  // 画像最適化設定
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
    },
  },
});
