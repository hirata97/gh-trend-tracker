import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { desc, eq, sql } from 'drizzle-orm';
import { repositories, repoSnapshots } from '../db/schema';

/**
 * 共通クエリ関数
 */

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
