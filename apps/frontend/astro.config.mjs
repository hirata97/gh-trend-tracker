import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  integrations: [
    react({
      // Reactコンポーネントの部分ハイドレーション最適化
      include: ['**/components/**'],
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
