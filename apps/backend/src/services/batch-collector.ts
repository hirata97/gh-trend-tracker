/**
 * バッチ収集のコアロジック
 * HTTPエンドポイントとCronトリガーの両方から呼び出される
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { BatchCollectResponse } from '@gh-trend-tracker/shared';
import { getTodayISO } from '../shared/utils';
import {
  getAllRepositoryFullNames,
  batchUpsertRepositories,
  batchInsertSnapshots,
  calculateAndUpsertMetricsBatch,
} from './batch-db';
import type { GitHubRepoData } from './github';
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

  // 3. 成功分のDB更新（upsert repo → insert snapshot → calculate metrics）
  const todayDate = getTodayISO();
  let dbSuccess = 0;
  let dbErrors = 0;

  const successResults = fetchSummary.results.filter(
    (r): r is { status: 'success'; data: GitHubRepoData } => r.status === 'success'
  );

  // リポジトリupsertをdb.batch()で一括実行（N RTT → 1 RTT）
  // 失敗時: リポジトリデータが未更新のためearly return
  try {
    await batchUpsertRepositories(db, successResults.map((r) => r.data));
  } catch (error) {
    dbErrors = successResults.length;
    console.error(
      `リポジトリ一括更新エラー: ${error instanceof Error ? error.message : error}`
    );
    return {
      message: 'Daily collection completed',
      summary: {
        total: fetchSummary.total,
        githubFetchSuccess: fetchSummary.success,
        githubNotFound: fetchSummary.notFound,
        githubErrors: fetchSummary.errors,
        dbUpdateSuccess: 0,
        dbUpdateErrors: dbErrors,
      },
      snapshotDate: todayDate,
      durationMs: Date.now() - startTime,
    };
  }

  // スナップショット挿入をdb.batch()で一括実行（N RTT → 1 RTT）
  // 失敗時: ログのみでメトリクス計算は続行（DB既存スナップショットで計算可能）
  let snapshotFailed = false;
  try {
    await batchInsertSnapshots(db, successResults.map((r) => r.data), todayDate);
  } catch (error) {
    snapshotFailed = true;
    console.error(
      `スナップショット一括挿入エラー: ${error instanceof Error ? error.message : error}`
    );
  }

  // 4. 全リポジトリのメトリクスをバッチ計算（todaySnaps取得を内部で7d/30dと並列化: 3RTT→2RTT）
  // DB実値を取得することでonConflictDoNothing後のスナップショット値との一貫性を担保
  if (successResults.length > 0) {
    try {
      const snapshotCount = await calculateAndUpsertMetricsBatch(db, todayDate);
      // スナップショット挿入失敗時は実際に書き込まれた件数で成否を判定する。
      // onConflictDoNothingで既存行をスキップした件数も含むため、
      // snapshotCountをsuccessの上限として扱う。
      const missing = successResults.length - snapshotCount;
      dbSuccess = snapshotCount;
      if (snapshotFailed && missing > 0) {
        dbErrors += missing;
      }
    } catch (error) {
      dbErrors += successResults.length;
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
