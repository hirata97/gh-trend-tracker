/**
 * 週別トレンドランキング集計のコアロジック
 * HTTPエンドポイントとCronトリガーの両方から呼び出される
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { BatchItem } from 'drizzle-orm/batch';
import { eq, and, between, lte, desc, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
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

  // selectDistinct(1RTT) + チャンク並列クエリ(1RTT) を単一結合クエリ(1RTT)に削減
  // 改善前: selectDistinct → repoId一覧取得 → チャンク分割 → Promise.all(チャンク) = 2RTT
  // 改善後: サブクエリINで対象週リポジトリを絞り込みつつ履歴スナップショットを一括取得 = 1RTT
  // 副次効果: D1バインドパラメータ上限(100)問題が不要（サブクエリはパラメータ化不要）
  const snapWeek = alias(repoSnapshots, 'snap_week');
  const snapAll = alias(repoSnapshots, 'snap_all');

  // 対象週にスナップショットのあるリポジトリIDを特定するサブクエリ
  const weeklyReposSubquery = db
    .selectDistinct({ repoId: snapWeek.repoId })
    .from(snapWeek)
    .where(between(snapWeek.snapshotDate, startDate, endDate));

  // 対象リポジトリの全履歴スナップショット（～endDate）を1クエリで取得
  // 注意: 履歴は90日間に制限されているため（CLAUDE.md参照）、最大500リポジトリ×90日=45,000行
  // D1の1レスポンス10MB上限に対して十分余裕がある
  const combinedRows = await db
    .select({
      repoId: repositories.repoId,
      fullName: repositories.fullName,
      language: repositories.language,
      snapshotDate: snapAll.snapshotDate,
      stars: snapAll.stars,
    })
    .from(repositories)
    .innerJoin(
      snapAll,
      and(eq(snapAll.repoId, repositories.repoId), lte(snapAll.snapshotDate, endDate))
    )
    .where(inArray(repositories.repoId, weeklyReposSubquery))
    .orderBy(repositories.repoId, desc(snapAll.snapshotDate));

  // 1パスでreposWithSnapshotsとsnapshotsByRepoを同時構築（クエリ結果はrepoId昇順・日付降順）
  const seenRepos = new Map<number, { repoId: number; fullName: string; language: string | null }>();
  const snapshotsByRepo = new Map<number, Array<{ snapshotDate: string; stars: number }>>();
  for (const row of combinedRows) {
    if (!seenRepos.has(row.repoId)) {
      seenRepos.set(row.repoId, { repoId: row.repoId, fullName: row.fullName, language: row.language });
    }
    const list = snapshotsByRepo.get(row.repoId);
    if (list) {
      list.push({ snapshotDate: row.snapshotDate, stars: row.stars });
    } else {
      snapshotsByRepo.set(row.repoId, [{ snapshotDate: row.snapshotDate, stars: row.stars }]);
    }
  }
  const reposWithSnapshots = [...seenRepos.values()];

  // 各リポジトリの週間スター増加数を計算
  const repoGrowth: Array<{
    repoId: number;
    fullName: string;
    language: string | null;
    starIncrease: number;
  }> = [];

  for (const repo of reposWithSnapshots) {
    const snapshots = snapshotsByRepo.get(repo.repoId) ?? [];

    let endStars: number | null = null;
    let startStars: number | null = null;

    for (const snap of snapshots) {
      if (endStars === null && snap.snapshotDate <= endDate) {
        endStars = snap.stars;
      }
      // NOTE: 週開始日当日のスナップショットを含めると、月曜の増加分が差分から漏れるため除外する
      if (startStars === null && snap.snapshotDate < startDate) {
        startStars = snap.stars;
      }
      if (endStars !== null && startStars !== null) {
        break;
      }
    }

    repoGrowth.push({
      repoId: repo.repoId,
      fullName: repo.fullName,
      language: repo.language,
      starIncrease: (endStars ?? 0) - (startStars ?? 0),
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

  // 各言語のランキングデータを収集し、db.batch()で一括書き込み（逐次O(2L)RTT → O(1)RTT）
  const batchItems: BatchItem<'sqlite'>[] = [];

  for (const lang of languageSet) {
    const filtered = lang === 'all' ? repoGrowth : repoGrowth.filter((r) => r.language === lang);

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
    batchItems.push(
      db
        .delete(rankingWeekly)
        .where(
          and(
            eq(rankingWeekly.year, year),
            eq(rankingWeekly.weekNumber, weekNumber),
            eq(rankingWeekly.language, lang)
          )
        )
    );

    batchItems.push(
      db.insert(rankingWeekly).values({
        year,
        weekNumber,
        language: lang,
        rankData: JSON.stringify(rankData),
      })
    );

    totalRankings++;
  }

  // 全言語の削除+挿入をdb.batch()で実行（O(2L)逐次RTT → O(ceil(L/50))）
  // D1は1バッチあたり最大100ステートメント制限があるため、50言語ペア(=100ステートメント)単位でチャンク分割
  const D1_BATCH_STMT_LIMIT = 100;
  for (let i = 0; i < batchItems.length; i += D1_BATCH_STMT_LIMIT) {
    const chunk = batchItems.slice(i, i + D1_BATCH_STMT_LIMIT) as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]];
    await db.batch(chunk);
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
