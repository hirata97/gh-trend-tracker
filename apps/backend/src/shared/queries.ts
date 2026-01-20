import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { desc, asc, eq, sql, like, and, or } from 'drizzle-orm';
import { repositories, repoSnapshots } from '../db/schema';
import type { TrendSortField, SortOrder } from '@gh-trend-tracker/shared';

/**
 * 共通クエリ関数
 */

/**
 * 検索・フィルタ・ソートオプション
 */
export interface TrendsQueryOptions {
  language?: string;
  q?: string;
  minStars?: number;
  maxStars?: number;
  sort?: TrendSortField;
  order?: SortOrder;
  limit?: number;
}

/**
 * 全言語のトレンドランキングを取得（検索・フィルタ・ソート対応）
 */
export async function getAllTrends(
  db: DrizzleD1Database,
  options: TrendsQueryOptions = {}
) {
  const {
    language,
    q,
    minStars,
    maxStars,
    sort = 'stars',
    order = 'desc',
    limit = 100,
  } = options;

  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // 今日のスナップショットを持つリポジトリを取得
  const todaySnapshots = db
    .select({
      repoId: repoSnapshots.repoId,
      stars: repoSnapshots.stars,
    })
    .from(repoSnapshots)
    .where(eq(repoSnapshots.snapshotDate, today))
    .as('today_snapshots');

  // 7日前のスナップショットをサブクエリとして準備
  const weekAgoSnapshots = db
    .select({
      repoId: repoSnapshots.repoId,
      stars: repoSnapshots.stars,
    })
    .from(repoSnapshots)
    .where(eq(repoSnapshots.snapshotDate, sevenDaysAgo))
    .as('week_ago_snapshots');

  // WHERE条件を構築
  const conditions = [];

  // 言語フィルタ
  if (language) {
    conditions.push(eq(repositories.language, language));
  }

  // テキスト検索（リポジトリ名、説明文、オーナー名）
  if (q) {
    const searchPattern = `%${q}%`;
    conditions.push(
      or(
        like(repositories.name, searchPattern),
        like(repositories.fullName, searchPattern),
        like(repositories.description, searchPattern),
        like(repositories.owner, searchPattern)
      )
    );
  }

  // メインクエリ: リポジトリと今日・7日前のスナップショットをJOIN
  // 注: minStars/maxStarsはJOIN後にフィルタするため、まず全件取得
  let query = db
    .select({
      repoId: repositories.repoId,
      name: repositories.name,
      fullName: repositories.fullName,
      owner: repositories.owner,
      language: repositories.language,
      description: repositories.description,
      htmlUrl: repositories.htmlUrl,
      currentStars: todaySnapshots.stars,
      weekAgoStars: weekAgoSnapshots.stars,
    })
    .from(repositories)
    .leftJoin(todaySnapshots, eq(repositories.repoId, todaySnapshots.repoId))
    .leftJoin(weekAgoSnapshots, eq(repositories.repoId, weekAgoSnapshots.repoId));

  // WHERE句を適用
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  // 取得件数を増やしてからスター数フィルタ（JOINカラムでのフィルタはアプリ側で行う）
  // D1のSQLiteではJOINしたサブクエリのカラムをWHERE句で直接使えないため
  const fetchLimit = (minStars !== undefined || maxStars !== undefined) ? 1000 : limit;

  // ソート適用（デフォルトはstars降順）
  // 注: growth_rateとweekly_growthは計算列のためアプリ側でソート
  const needsAppSort = sort === 'growth_rate' || sort === 'weekly_growth';
  if (!needsAppSort) {
    const orderFunc = order === 'asc' ? asc : desc;
    query = query.orderBy(orderFunc(todaySnapshots.stars)) as typeof query;
  }

  const results = await query.limit(fetchLimit);

  // 増加率を計算してから追加フィルタ・ソートを適用
  let processedResults = results.map((item) => {
    const weeklyGrowth = calculateWeeklyGrowth(item.currentStars, item.weekAgoStars);
    const weeklyGrowthRate = calculateWeeklyGrowthRate(item.currentStars, item.weekAgoStars);
    return {
      repoId: item.repoId,
      name: item.name,
      fullName: item.fullName,
      owner: item.owner,
      language: item.language,
      description: item.description,
      htmlUrl: item.htmlUrl,
      currentStars: item.currentStars,
      weeklyGrowth,
      weeklyGrowthRate,
    };
  });

  // スター数フィルタ（アプリ側で適用）
  if (minStars !== undefined) {
    processedResults = processedResults.filter(
      (item) => item.currentStars !== null && item.currentStars >= minStars
    );
  }
  if (maxStars !== undefined) {
    processedResults = processedResults.filter(
      (item) => item.currentStars !== null && item.currentStars <= maxStars
    );
  }

  // growth_rateまたはweekly_growthでソート
  if (needsAppSort) {
    const multiplier = order === 'asc' ? 1 : -1;
    if (sort === 'growth_rate') {
      processedResults.sort((a, b) => {
        const aVal = a.weeklyGrowthRate ?? -Infinity;
        const bVal = b.weeklyGrowthRate ?? -Infinity;
        return (aVal - bVal) * multiplier;
      });
    } else if (sort === 'weekly_growth') {
      processedResults.sort((a, b) => {
        const aVal = a.weeklyGrowth ?? -Infinity;
        const bVal = b.weeklyGrowth ?? -Infinity;
        return (aVal - bVal) * multiplier;
      });
    }
  }

  // 最終的なlimit適用
  return processedResults.slice(0, limit);
}

/**
 * 週間スター増加数を計算
 */
function calculateWeeklyGrowth(
  currentStars: number | null,
  weekAgoStars: number | null
): number | null {
  if (currentStars === null) return null;
  if (weekAgoStars === null) return null;
  return currentStars - weekAgoStars;
}

/**
 * 週間スター増加率を計算（%）
 */
function calculateWeeklyGrowthRate(
  currentStars: number | null,
  weekAgoStars: number | null
): number | null {
  if (currentStars === null || weekAgoStars === null) return null;
  if (weekAgoStars === 0) return currentStars > 0 ? 100 : 0;
  return Math.round(((currentStars - weekAgoStars) / weekAgoStars) * 10000) / 100;
}

/**
 * リポジトリの履歴データを取得
 */
export async function getRepositoryHistory(
  db: DrizzleD1Database,
  repoId: number,
  days: number = 90
) {
  return await db
    .select()
    .from(repoSnapshots)
    .where(eq(repoSnapshots.repoId, repoId))
    .orderBy(desc(repoSnapshots.snapshotDate))
    .limit(days);
}

/**
 * データベース内の全言語一覧を取得
 */
export async function getAllLanguages(db: DrizzleD1Database) {
  const languages = await db
    .selectDistinct({ language: repositories.language })
    .from(repositories)
    .where(sql`${repositories.language} IS NOT NULL`)
    .orderBy(repositories.language);

  return languages.map((l) => l.language);
}

/**
 * リポジトリ詳細情報を取得（スター増加率付き）
 */
export async function getRepositoryDetail(db: DrizzleD1Database, repoId: number) {

  // リポジトリ基本情報を取得
  const [repository] = await db
    .select()
    .from(repositories)
    .where(eq(repositories.repoId, repoId))
    .limit(1);

  if (!repository) {
    return null;
  }

  // 今日のスナップショットを取得
  const [todaySnapshot] = await db
    .select()
    .from(repoSnapshots)
    .where(eq(repoSnapshots.repoId, repoId))
    .orderBy(desc(repoSnapshots.snapshotDate))
    .limit(1);

  // 7日前のスナップショットを取得
  const [weekAgoSnapshot] = await db
    .select()
    .from(repoSnapshots)
    .where(eq(repoSnapshots.repoId, repoId))
    .orderBy(desc(repoSnapshots.snapshotDate))
    .offset(6)
    .limit(1);

  // トピックスをパース
  let topics: string[] = [];
  if (repository.topics) {
    try {
      topics = JSON.parse(repository.topics);
    } catch {
      topics = [];
    }
  }

  const weeklyGrowth = calculateWeeklyGrowth(
    todaySnapshot?.stars ?? null,
    weekAgoSnapshot?.stars ?? null
  );
  const weeklyGrowthRate = calculateWeeklyGrowthRate(
    todaySnapshot?.stars ?? null,
    weekAgoSnapshot?.stars ?? null
  );

  return {
    repository: {
      repoId: repository.repoId,
      name: repository.name,
      fullName: repository.fullName,
      owner: repository.owner,
      language: repository.language,
      description: repository.description,
      htmlUrl: repository.htmlUrl,
      homepage: repository.homepage,
      topics,
    },
    currentStats: todaySnapshot
      ? {
          stars: todaySnapshot.stars,
          forks: todaySnapshot.forks,
          watchers: todaySnapshot.watchers,
          openIssues: todaySnapshot.openIssues,
          snapshotDate: todaySnapshot.snapshotDate,
        }
      : null,
    weeklyGrowth,
    weeklyGrowthRate,
  };
}
