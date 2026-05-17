/**
 * メトリクス計算のコアロジック
 * HTTPエンドポイントとCronトリガーの両方から呼び出される
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { inArray } from 'drizzle-orm';
import type { BatchMetricsResponse } from '@gh-trend-tracker/shared';
import { getTodayISO } from '../shared/utils';
import { repoSnapshots } from '../db/schema';
import { calculateAndUpsertMetricsBatch, getDaysAgoDate } from './batch-db';

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
  const sevenDaysAgoStr = getDaysAgoDate(todayDate, 7);
  const thirtyDaysAgoStr = getDaysAgoDate(todayDate, 30);

  // 今日・7日前・30日前のスナップショットを1クエリで一括取得（3 RTT → 1 RTT）
  const allSnaps = await db
    .select({
      repoId: repoSnapshots.repoId,
      snapshotDate: repoSnapshots.snapshotDate,
      stars: repoSnapshots.stars,
    })
    .from(repoSnapshots)
    .where(inArray(repoSnapshots.snapshotDate, [todayDate, sevenDaysAgoStr, thirtyDaysAgoStr]));

  const todayStarsMap = new Map<number, number>();
  const snap7d = new Map<number, number>();
  const snap30d = new Map<number, number>();
  for (const snap of allSnaps) {
    if (snap.snapshotDate === todayDate) todayStarsMap.set(snap.repoId, snap.stars);
    else if (snap.snapshotDate === sevenDaysAgoStr) snap7d.set(snap.repoId, snap.stars);
    else if (snap.snapshotDate === thirtyDaysAgoStr) snap30d.set(snap.repoId, snap.stars);
    // else: inArray の3日付以外は無視（将来の拡張時の誤混入を防止）
  }

  const todaySnaps = Array.from(todayStarsMap, ([repoId, stars]) => ({ repoId, stars }));

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
    // 事前取得済みマップを渡してDBクエリを省略（INクエリで取得済み）
    await calculateAndUpsertMetricsBatch(db, todaySnaps, todayDate, { snap7d, snap30d });
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
