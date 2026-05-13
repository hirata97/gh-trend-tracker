/**
 * バッチ収集のコアロジック
 * HTTPエンドポイントとCronトリガーの両方から呼び出される
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { BatchCollectResponse } from '@gh-trend-tracker/shared';
import { getTodayISO } from '../shared/utils';
import {
  getAllRepositoryFullNames,
  upsertRepository,
  insertSnapshot,
  getTodaySnapshots,
  calculateAndUpsertMetricsBatch,
} from './batch-db';
import { fetchRepositories } from './github';

export interface CollectOptions {
  db: DrizzleD1Database;
  githubToken: string;
  /** 処理するリポジトリ数の上限（未指定で全件処理） */
  limit?: number;
}

/**
 * 日次データ収集のコア処理
 */
export async function runDailyCollection(options: CollectOptions): Promise<BatchCollectResponse> {
  const { db, githubToken, limit } = options;
  const startTime = Date.now();

  // 1. 全リポジトリのfullNameリストを取得
  let fullNames = await getAllRepositoryFullNames(db);

  if (fullNames.length === 0) {
    return {
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
  }

  // limit指定時は先頭N件のみ処理
  if (limit && limit > 0) {
    fullNames = fullNames.slice(0, limit);
  }

  // 2. GitHub APIから最新データを取得
  const fetchSummary = await fetchRepositories(fullNames, githubToken);

  // 3. 成功分のDB更新（upsert repo → insert snapshot）
  const todayDate = getTodayISO();
  let dbSuccess = 0;
  let dbErrors = 0;
  let snapshotSuccessCount = 0;

  for (const result of fetchSummary.results) {
    if (result.status !== 'success') continue;

    try {
      await upsertRepository(db, result.data);
      await insertSnapshot(db, result.data, todayDate);
      snapshotSuccessCount++;
    } catch (error) {
      dbErrors++;
      console.error(
        `DB更新エラー: ${result.data.full_name} - ${error instanceof Error ? error.message : error}`
      );
    }
  }

  // 4. 全リポジトリのメトリクスをバッチ計算（N+1クエリ問題を解消: O(4N)→O(2)ラウンドトリップ）
  // DB実値を取得することでonConflictDoNothing後のスナップショット値との一貫性を担保
  if (snapshotSuccessCount > 0) {
    try {
      const todaySnaps = await getTodaySnapshots(db, todayDate);
      await calculateAndUpsertMetricsBatch(db, todaySnaps, todayDate);
      dbSuccess = snapshotSuccessCount;
    } catch (error) {
      dbErrors += snapshotSuccessCount;
      console.error(
        `バッチメトリクス計算エラー: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined
      );
    }
  }

  return {
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
}
