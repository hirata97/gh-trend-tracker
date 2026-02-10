/**
 * 日次データ収集バッチエンドポイント
 * POST /api/internal/batch/collect-daily
 *
 * リポジトリテーブルに登録済みの全リポジトリについて、
 * GitHub APIから最新データを取得し、スナップショットとメトリクスを更新する
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../types/app';
import type { ApiError, BatchCollectResponse } from '@gh-trend-tracker/shared';
import { internalAuthMiddleware } from '../../middleware/internal-auth';
import { internalError } from '../../shared/errors';
import { getTodayISO } from '../../shared/utils';
import {
  getAllRepositoryFullNames,
  upsertRepository,
  insertSnapshot,
  calculateAndUpsertMetrics,
} from '../../services/batch-db';
import { fetchRepositories } from '../../services/github';

const collectDaily = new Hono<AppEnv>();

// 内部認証ミドルウェアを適用
collectDaily.use('/*', internalAuthMiddleware);

collectDaily.post('/', async (c) => {
  const startTime = Date.now();
  const db = c.get('db');
  const githubToken = c.env.GITHUB_TOKEN;

  if (!githubToken) {
    console.error('GITHUB_TOKEN環境変数が設定されていません');
    const errorResponse: ApiError = internalError('GitHub token not configured');
    return c.json(errorResponse, 500);
  }

  try {
    // 1. 全リポジトリのfullNameリストを取得
    const fullNames = await getAllRepositoryFullNames(db);
    if (fullNames.length === 0) {
      const response: BatchCollectResponse = {
        message: 'No repositories to process',
        summary: {
          total: 0,
          githubFetchSuccess: 0,
          githubNotFound: 0,
          githubErrors: 0,
          dbUpdateSuccess: 0,
          dbUpdateErrors: 0,
        },
        snapshotDate: getTodayISO(),
        durationMs: Date.now() - startTime,
      };
      return c.json(response);
    }

    // 2. GitHub APIから最新データを取得
    const fetchSummary = await fetchRepositories(fullNames, githubToken);

    // 3. 成功分のDB更新（upsert repo → insert snapshot → calculate metrics）
    const todayDate = getTodayISO();
    let dbSuccess = 0;
    let dbErrors = 0;

    for (const result of fetchSummary.results) {
      if (result.status !== 'success') continue;

      try {
        await upsertRepository(db, result.data);
        await insertSnapshot(db, result.data, todayDate);
        await calculateAndUpsertMetrics(db, result.data.id, todayDate);
        dbSuccess++;
      } catch (error) {
        dbErrors++;
        console.error(
          `DB更新エラー: ${result.data.full_name} - ${error instanceof Error ? error.message : error}`
        );
      }
    }

    const response: BatchCollectResponse = {
      message: 'Daily collection completed',
      summary: {
        total: fetchSummary.total,
        githubFetchSuccess: fetchSummary.success,
        githubNotFound: fetchSummary.notFound,
        githubErrors: fetchSummary.errors,
        dbUpdateSuccess: dbSuccess,
        dbUpdateErrors: dbErrors,
      },
      snapshotDate: todayDate,
      durationMs: Date.now() - startTime,
    };

    return c.json(response);
  } catch (error) {
    console.error('バッチ処理中の致命的エラー:', error);
    const errorResponse: ApiError = internalError('Batch collection failed');
    return c.json(errorResponse, 500);
  }
});

export default collectDaily;
