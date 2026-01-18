import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { desc, eq, and, sql } from 'drizzle-orm';
import { repositories, repoSnapshots } from '../db/schema';

/**
 * 共通クエリ関数
 */

/**
 * 指定言語のトレンドランキングを取得
 */
export async function getTrendsByLanguage(
  db: DrizzleD1Database,
  language: string,
  limit: number = 100
) {
  const today = new Date().toISOString().split('T')[0];

  return await db
    .select({
      repoId: repositories.repoId,
      name: repositories.name,
      fullName: repositories.fullName,
      owner: repositories.owner,
      language: repositories.language,
      description: repositories.description,
      htmlUrl: repositories.htmlUrl,
      currentStars: repoSnapshots.stars,
      snapshotDate: repoSnapshots.snapshotDate,
    })
    .from(repositories)
    .leftJoin(
      repoSnapshots,
      and(
        eq(repositories.repoId, repoSnapshots.repoId),
        eq(repoSnapshots.snapshotDate, today)
      )
    )
    .where(eq(repositories.language, language))
    .orderBy(desc(repoSnapshots.stars))
    .limit(limit);
}

/**
 * 全言語のトレンドランキングを取得
 */
export async function getAllTrends(db: DrizzleD1Database, limit: number = 100) {
  const today = new Date().toISOString().split('T')[0];

  return await db
    .select({
      repoId: repositories.repoId,
      name: repositories.name,
      fullName: repositories.fullName,
      owner: repositories.owner,
      language: repositories.language,
      description: repositories.description,
      htmlUrl: repositories.htmlUrl,
      currentStars: repoSnapshots.stars,
    })
    .from(repositories)
    .leftJoin(
      repoSnapshots,
      and(
        eq(repositories.repoId, repoSnapshots.repoId),
        eq(repoSnapshots.snapshotDate, today)
      )
    )
    .orderBy(desc(repoSnapshots.stars))
    .limit(limit);
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
