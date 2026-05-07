/**
 * メトリクス計算のコアロジック
 * HTTPエンドポイントとCronトリガーの両方から呼び出される
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import type { BatchMetricsResponse } from '@gh-trend-tracker/shared';
import { getTodayISO } from '../shared/utils';
import { repositories, repoSnapshots } from '../db/schema';
import { calculateAndUpsertMetricsBatch } from './batch-db';

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

  // 本日のスナップショットがあるリポジトリID・スター数を一括取得（初回クエリでstarsも取得し後続クエリを削減）
  const todaySnaps = await db
    .select({ repoId: repoSnapshots.repoId, stars: repoSnapshots.stars })
    .from(repoSnapshots)
    .innerJoin(repositories, eq(repoSnapshots.repoId, repositories.repoId))
    .where(eq(repoSnapshots.snapshotDate, todayDate));

  if (todaySnaps.length === 0) {
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

  try {
    // JOINバッチ化でN+1クエリ問題を解消（O(5N)クエリ → O(N/16+4)クエリ）
    await calculateAndUpsertMetricsBatch(db, todaySnaps, todayDate);
    success = todaySnaps.length;
  } catch (error) {
    errors = todaySnaps.length;
    console.error(
      `バッチメトリクス計算エラー: ${error instanceof Error ? error.message : error}`,
      error instanceof Error ? error.stack : undefined
    );
  }

  return {
    message: 'Metrics calculation completed',
    summary: {
      total: todaySnaps.length,
      success,
      skipped,
      errors,
    },
    calculatedDate: todayDate,
    durationMs: Date.now() - startTime,
  };
}
