/**
 * メトリクス計算のコアロジック
 * HTTPエンドポイントとCronトリガーの両方から呼び出される
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import type { BatchMetricsResponse } from '@gh-trend-tracker/shared';
import { getTodayISO } from '../shared/utils';
import { repositories, repoSnapshots } from '../db/schema';
import { calculateAndUpsertMetrics } from './batch-db';

export interface MetricsCalculateOptions {
  db: DrizzleD1Database;
}

/**
 * 全リポジトリのメトリクスを計算・保存する
 * 本日のスナップショットがあるリポジトリのみ処理対象
 */
export async function runMetricsCalculation(
  options: MetricsCalculateOptions
): Promise<BatchMetricsResponse> {
  const { db } = options;
  const startTime = Date.now();
  const todayDate = getTodayISO();

  // 本日のスナップショットがあるリポジトリIDを取得
  const repoRows = await db
    .select({ repoId: repoSnapshots.repoId })
    .from(repoSnapshots)
    .innerJoin(repositories, eq(repoSnapshots.repoId, repositories.repoId))
    .where(eq(repoSnapshots.snapshotDate, todayDate));

  if (repoRows.length === 0) {
    return {
      message: 'No repositories with snapshots for today',
      summary: {
        total: 0,
        success: 0,
        skipped: 0,
        errors: 0,
      },
      calculatedDate: todayDate,
      durationMs: Date.now() - startTime,
    };
  }

  let success = 0;
  const skipped = 0;
  let errors = 0;

  for (const row of repoRows) {
    try {
      await calculateAndUpsertMetrics(db, row.repoId, todayDate);
      success++;
    } catch (error) {
      errors++;
      console.error(
        `メトリクス計算エラー: repoId=${row.repoId} - ${error instanceof Error ? error.message : error}`
      );
    }
  }

  return {
    message: 'Metrics calculation completed',
    summary: {
      total: repoRows.length,
      success,
      skipped,
      errors,
    },
    calculatedDate: todayDate,
    durationMs: Date.now() - startTime,
  };
}
