/**
 * トレンドエンドポイントのOpenAPI定義
 */
import { createRoute, z } from '@hono/zod-openapi';
import { TrendsResponseSchema } from '../schemas';
import { ApiErrorSchema } from '../schemas/error';

export const getAllTrendsRoute = createRoute({
  method: 'get',
  path: '/api/trends',
  tags: ['Trends'],
  summary: '全言語のトレンドを取得',
  description: 'すべての言語のトレンドリポジトリ上位100件を取得します',
  responses: {
    200: {
      description: 'トレンドリポジトリのリスト',
      content: {
        'application/json': {
          schema: TrendsResponseSchema,
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

export const getTrendsByLanguageRoute = createRoute({
  method: 'get',
  path: '/api/trends/{language}',
  tags: ['Trends'],
  summary: '言語別トレンドを取得',
  description: '指定した言語のトレンドリポジトリ上位100件を取得します',
  request: {
    params: z.object({
      language: z.string().openapi({
        description: 'プログラミング言語名',
        example: 'JavaScript',
      }),
    }),
  },
  responses: {
    200: {
      description: '指定言語のトレンドリポジトリのリスト',
      content: {
        'application/json': {
          schema: TrendsResponseSchema,
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
