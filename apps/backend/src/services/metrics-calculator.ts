/**
 * メトリクス計算のコアロジック
 * HTTPエンドポイントとCronトリガーの両方から呼び出される
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { BatchMetricsResponse } from '@gh-trend-tracker/shared';
import { getTodayISO } from '../shared/utils';
import { calculateAndUpsertMetricsBatch, getTodaySnapshots } from './batch-db';

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

  let success = 0;
  const skipped = 0;
  let errors = 0;
  let total = 0;

  try {
    // todaySnaps取得をcalculateAndUpsertMetricsBatch内で7d/30dと並列実行（3RTT→2RTT）
    success = await calculateAndUpsertMetricsBatch(db, todayDate);
    total = success;
  } catch (error) {
    // エラー時のみ件数を問い合わせて正確な total/errors を設定（成功パスにRTT影響なし）
    const snaps = await getTodaySnapshots(db, todayDate).catch(() => []);
    total = snaps.length;
    errors = snaps.length || 1;
    console.error(
      `バッチメトリクス計算エラー: ${error instanceof Error ? error.message : error}`,
      error instanceof Error ? error.stack : undefined
    );
  }

  if (total === 0 && errors === 0) {
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

  return {
    message: 'Metrics calculation completed',
    summary: {
      total,
      success,
      skipped,
      errors,
    },
    calculatedDate: todayDate,
    durationMs: Date.now() - startTime,
  };
}
