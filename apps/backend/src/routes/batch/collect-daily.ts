/**
 * 日次データ収集バッチエンドポイント
 * POST /api/internal/batch/collect-daily
 *
 * リポジトリテーブルに登録済みのリポジトリについて、
 * GitHub APIから最新データを取得し、スナップショットとメトリクスを更新する
 *
 * クエリパラメータ:
 *   limit - 処理するリポジトリ数の上限（デフォルト: 50、HTTPタイムアウト対策）
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../types/app';
import type { ApiError } from '@gh-trend-tracker/shared';
import { internalAuthMiddleware } from '../../middleware/internal-auth';
import { internalError } from '../../shared/errors';
import { runDailyCollection } from '../../services/batch-collector';

/** HTTPリクエスト経由のデフォルト処理件数（タイムアウト対策） */
const DEFAULT_HTTP_LIMIT = 50;

const collectDaily = new Hono<AppEnv>();

// 内部認証ミドルウェアを適用
collectDaily.use('/*', internalAuthMiddleware);

collectDaily.post('/', async (c) => {
  const db = c.get('db');
  const githubToken = c.env.GITHUB_TOKEN;

  if (!githubToken) {
    console.error('GITHUB_TOKEN環境変数が設定されていません');
    const errorResponse: ApiError = internalError('GitHub token not configured');
    return c.json(errorResponse, 500);
  }

  // limitパラメータ（未指定時はDEFAULT_HTTP_LIMIT）
  const limitParam = c.req.query('limit');
  const limit = limitParam ? Math.max(1, Math.min(parseInt(limitParam, 10) || DEFAULT_HTTP_LIMIT, 1000)) : DEFAULT_HTTP_LIMIT;

  try {
    const response = await runDailyCollection({ db, githubToken, limit });
    return c.json(response);
  } catch (error) {
    console.error('バッチ処理中の致命的エラー:', error);
    const errorResponse: ApiError = internalError('Batch collection failed');
    return c.json(errorResponse, 500);
  }
});

export default collectDaily;
