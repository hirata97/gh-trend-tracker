/**
 * 言語エンドポイントのOpenAPI定義
 */
import { createRoute } from '@hono/zod-openapi';
import { LanguagesResponseSchema } from '../schemas';
import { ApiErrorSchema } from '../schemas/error';

export const getLanguagesRoute = createRoute({
  method: 'get',
  path: '/api/languages',
  tags: ['Languages'],
  summary: '言語一覧を取得',
  description: 'データベースに存在するすべてのプログラミング言語のリストを取得します',
  responses: {
    200: {
      description: '言語のリスト',
      content: {
        'application/json': {
          schema: LanguagesResponseSchema,
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
