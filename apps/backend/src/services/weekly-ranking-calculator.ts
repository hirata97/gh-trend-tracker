/**
 * 週別トレンドランキング集計のコアロジック
 * HTTPエンドポイントとCronトリガーの両方から呼び出される
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, between, lte, desc } from 'drizzle-orm';
import type { BatchWeeklyRankingResponse, WeeklyRankEntry } from '@gh-trend-tracker/shared';
import { repositories, repoSnapshots, rankingWeekly } from '../db/schema';

export interface WeeklyRankingOptions {
  db: DrizzleD1Database;
  /** 集計対象日（省略時は現在日時から前の週を計算） */
  targetDate?: Date;
}

/**
 * ISO週番号と年を計算する
 * ISO 8601: 週の開始は月曜、1月4日を含む週が第1週
 */
export function getISOWeekInfo(date: Date): { year: number; weekNumber: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // 最も近い木曜日に調整（ISO 8601）
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), weekNumber };
}

/**
 * ISO週の開始日（月曜）と終了日（日曜）を計算する
 */
export function getISOWeekRange(
  year: number,
  weekNumber: number
): { startDate: string; endDate: string } {
  // 1月4日は必ず第1週に含まれる
  const jan4 = new Date(Date.UTC(year, 0, 4));
  // 1月4日が含まれる週の月曜日を求める
  const dayOfWeek = jan4.getUTCDay() || 7; // 日曜=7に変換
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);

  // 対象週の月曜日
  const targetMonday = new Date(week1Monday);
  targetMonday.setUTCDate(week1Monday.getUTCDate() + (weekNumber - 1) * 7);

  // 対象週の日曜日
  const targetSunday = new Date(targetMonday);
  targetSunday.setUTCDate(targetMonday.getUTCDate() + 6);

  return {
    startDate: targetMonday.toISOString().split('T')[0],
    endDate: targetSunday.toISOString().split('T')[0],
  };
}

/**
 * 週別トレンドランキングを計算・保存する
 * デフォルトでは前の週（先週月曜〜日曜）を集計対象とする
 */
export async function runWeeklyRankingCalculation(
  options: WeeklyRankingOptions
): Promise<BatchWeeklyRankingResponse> {
  const { db, targetDate } = options;
  const startTime = Date.now();

  // 集計対象のISO週を決定（デフォルト: 前の週）
  const baseDate = targetDate ?? new Date();
  const lastWeek = new Date(baseDate);
  lastWeek.setUTCDate(lastWeek.getUTCDate() - 7);
  const { year, weekNumber } = getISOWeekInfo(lastWeek);
  const { startDate, endDate } = getISOWeekRange(year, weekNumber);

  // 対象週にスナップショットが存在するリポジトリを取得
  const reposWithSnapshots = await db
    .selectDistinct({
      repoId: repositories.repoId,
      fullName: repositories.fullName,
      language: repositories.language,
    })
    .from(repositories)
    .innerJoin(repoSnapshots, eq(repositories.repoId, repoSnapshots.repoId))
    .where(between(repoSnapshots.snapshotDate, startDate, endDate));

  // 各リポジトリの週間スター増加数を計算
  const repoGrowth: Array<{
    repoId: number;
    fullName: string;
    language: string | null;
    starIncrease: number;
  }> = [];

  for (const repo of reposWithSnapshots) {
    // 週開始日以前の最新スナップショット（開始時点のスター数）
    const startSnap = await db
      .select({ stars: repoSnapshots.stars })
      .from(repoSnapshots)
      .where(
        and(
          eq(repoSnapshots.repoId, repo.repoId),
          lte(repoSnapshots.snapshotDate, startDate)
        )
      )
      .orderBy(desc(repoSnapshots.snapshotDate))
      .limit(1);

    // 週終了日以前の最新スナップショット（終了時点のスター数）
    const endSnap = await db
      .select({ stars: repoSnapshots.stars })
      .from(repoSnapshots)
      .where(
        and(
          eq(repoSnapshots.repoId, repo.repoId),
          lte(repoSnapshots.snapshotDate, endDate)
        )
      )
      .orderBy(desc(repoSnapshots.snapshotDate))
      .limit(1);

    const startStars = startSnap[0]?.stars ?? 0;
    const endStars = endSnap[0]?.stars ?? 0;
    const starIncrease = endStars - startStars;

    repoGrowth.push({
      repoId: repo.repoId,
      fullName: repo.fullName,
      language: repo.language,
      starIncrease,
    });
  }

  // 言語リストを収集（全言語 + 個別言語）
  const languageSet = new Set<string>();
  languageSet.add('all');
  for (const repo of repoGrowth) {
    if (repo.language) {
      languageSet.add(repo.language);
    }
  }

  let totalRankings = 0;

  // 各言語でランキングを作成
  for (const lang of languageSet) {
    const filtered =
      lang === 'all' ? repoGrowth : repoGrowth.filter((r) => r.language === lang);

    // スター増加数の降順でソートし、トップ10を取得
    const sorted = [...filtered].sort((a, b) => b.starIncrease - a.starIncrease).slice(0, 10);

    const rankData: WeeklyRankEntry[] = sorted.map((item, idx) => ({
      rank: idx + 1,
      repo_id: item.repoId,
      repo_full_name: item.fullName,
      star_increase: item.starIncrease,
    }));

    if (rankData.length === 0) {
      continue;
    }

    // 既存データを削除してから挿入（冪等性を保証）
    await db
      .delete(rankingWeekly)
      .where(
        and(
          eq(rankingWeekly.year, year),
          eq(rankingWeekly.weekNumber, weekNumber),
          eq(rankingWeekly.language, lang)
        )
      );

    await db.insert(rankingWeekly).values({
      year,
      weekNumber,
      language: lang,
      rankData: JSON.stringify(rankData),
    });

    totalRankings++;
  }

  return {
    message: 'Weekly ranking calculation completed',
    summary: {
      totalRankings,
      totalRepos: repoGrowth.length,
    },
    year,
    weekNumber,
    durationMs: Date.now() - startTime,
  };
}
