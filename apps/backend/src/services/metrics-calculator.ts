/**
 * メトリクス計算のコアロジック
 * HTTPエンドポイントとCronトリガーの両方から呼び出される
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { BatchMetricsResponse } from '@gh-trend-tracker/shared';
import { getTodayISO } from '../shared/utils';
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

  // 例外はルートハンドラに伝播させ500レスポンスとする（D1障害を200で隠蔽しない）
  // LEFT JOINで today+7d+30d を1クエリ1RTTで取得し、db.batchで書き込み（計2RTT）
  const todaySnaps = await calculateAndUpsertMetricsBatch(db, todayDate);

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

  return {
    message: 'Metrics calculation completed',
    summary: {
      total: todaySnaps.length,
      success: todaySnaps.length,
      skipped: 0,
      errors: 0,
    },
    calculatedDate: todayDate,
    durationMs: Date.now() - startTime,
  };
}
