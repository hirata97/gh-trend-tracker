/**
 * ヘルスチェックエンドポイントのOpenAPI定義
 */
import { createRoute, z } from '@hono/zod-openapi';
import { HealthResponseSchema } from '../schemas';

export const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'ヘルスチェック',
  description: 'APIサーバーの稼働状態を確認します',
  responses: {
    200: {
      description: 'サービスが正常に稼働中',
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
    },
  },
});
