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

  // 今日・7日前・30日前のスナップショットを1クエリで一括取得（3RTT→2RTTに削減）
  // 旧: today(1RTT) + Promise.all([7d, 30d])(1RTT) + batch(1RTT) = 3RTT
  // 新: combined(1RTT) + batch(1RTT) = 2RTT（33%削減）
  const allSnaps = await db
    .select({
      repoId: repoSnapshots.repoId,
      stars: repoSnapshots.stars,
      snapshotDate: repoSnapshots.snapshotDate,
    })
    .from(repoSnapshots)
    .where(inArray(repoSnapshots.snapshotDate, [todayDate, sevenDaysAgoStr, thirtyDaysAgoStr]));

  const todaySnaps = allSnaps
    .filter((s) => s.snapshotDate === todayDate)
    .map((s) => ({ repoId: s.repoId, stars: s.stars }));

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

  // 7日前・30日前のマップをクライアント側で構築（追加クエリ不要）
  const snap7dMap = new Map<number, number>();
  const snap30dMap = new Map<number, number>();
  for (const snap of allSnaps) {
    if (snap.snapshotDate === sevenDaysAgoStr) {
      snap7dMap.set(snap.repoId, snap.stars);
    } else if (snap.snapshotDate === thirtyDaysAgoStr) {
      snap30dMap.set(snap.repoId, snap.stars);
    }
  }

  let success = 0;
  const skipped = 0;
  let errors = 0;

  try {
    await calculateAndUpsertMetricsBatch(db, todaySnaps, todayDate, snap7dMap, snap30dMap);
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
