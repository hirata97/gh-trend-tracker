/**
 * リポジトリエンドポイントのOpenAPI定義
 */
import { createRoute, z } from '@hono/zod-openapi';
import { HistoryResponseSchema } from '../schemas';
import { ApiErrorSchema } from '../schemas/error';

export const getRepositoryHistoryRoute = createRoute({
  method: 'get',
  path: '/api/repos/{repoId}/history',
  tags: ['Repositories'],
  summary: 'リポジトリの履歴を取得',
  description: '指定したリポジトリの過去90日間のスナップショット履歴を取得します',
  request: {
    params: z.object({
      repoId: z.string().openapi({
        description: 'リポジトリID（正の整数）',
        example: '1',
      }),
    }),
  },
  responses: {
    200: {
      description: 'リポジトリの履歴スナップショットリスト',
      content: {
        'application/json': {
          schema: HistoryResponseSchema,
        },
      },
    },
    400: {
      description: '無効なリクエストパラメータ',
      content: {
        'application/json': {
          schema: ApiErrorSchema,
        },
      },
    },
    404: {
      description: 'リポジトリが見つからない',
      content: {
        'application/json': {
          schema: ApiErrorSchema,
        },
      },
    },
    500: {
      description: 'サーバーエラー',
      content: {
        'application/json': {
          schema: ApiErrorSchema,
        },
      },
    },
  },
});
