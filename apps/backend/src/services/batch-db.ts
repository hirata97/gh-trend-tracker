/**
 * バッチ処理用データベース操作
 * リポジトリメタデータの更新、スナップショットの挿入、メトリクス計算
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { repositories, repoSnapshots, metricsDaily } from '../db/schema';
import type { GitHubRepoData } from './github';

/**
 * 全リポジトリのfullNameリストを取得
 */
export async function getAllRepositoryFullNames(db: DrizzleD1Database): Promise<string[]> {
  const rows = await db.select({ fullName: repositories.fullName }).from(repositories);
  return rows.map((r) => r.fullName);
}

/**
 * リポジトリメタデータをupsert（GitHub APIデータで更新）
 */
export async function upsertRepository(db: DrizzleD1Database, data: GitHubRepoData): Promise<void> {
  const values = {
    repoId: data.id,
    name: data.name,
    fullName: data.full_name,
    owner: data.owner.login,
    language: data.language,
    description: data.description,
    htmlUrl: data.html_url,
    homepage: data.homepage,
    topics: data.topics.length > 0 ? JSON.stringify(data.topics) : null,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    pushedAt: data.pushed_at,
  };

  await db
    .insert(repositories)
    .values(values)
    .onConflictDoUpdate({
      target: repositories.repoId,
      set: {
        name: values.name,
        fullName: values.fullName,
        owner: values.owner,
        language: values.language,
        description: values.description,
        htmlUrl: values.htmlUrl,
        homepage: values.homepage,
        topics: values.topics,
        updatedAt: values.updatedAt,
        pushedAt: values.pushedAt,
      },
    });
}

/**
 * 日次スナップショットを挿入（同日の重複は無視）
 */
export async function insertSnapshot(
  db: DrizzleD1Database,
  data: GitHubRepoData,
  snapshotDate: string
): Promise<void> {
  await db
    .insert(repoSnapshots)
    .values({
      repoId: data.id,
      stars: data.stargazers_count,
      forks: data.forks_count,
      watchers: data.watchers_count,
      openIssues: data.open_issues_count,
      snapshotDate,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing();
}

/**
 * N日前の日付をISO形式で計算
 */
function getDaysAgoDate(baseDate: string, days: number): string {
  const date = new Date(baseDate);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().split('T')[0];
}

/**
 * メトリクス（7日/30日のスター増加数・増加率）を計算してupsert
 */
export async function calculateAndUpsertMetrics(
  db: DrizzleD1Database,
  repoId: number,
  todayDate: string
): Promise<void> {
  // 今日のスナップショットを取得
  const todayRows = await db
    .select({ stars: repoSnapshots.stars })
    .from(repoSnapshots)
    .where(and(eq(repoSnapshots.repoId, repoId), eq(repoSnapshots.snapshotDate, todayDate)))
    .limit(1);

  if (todayRows.length === 0) return;

  const currentStars = todayRows[0].stars;
  const sevenDaysAgoStr = getDaysAgoDate(todayDate, 7);
  const thirtyDaysAgoStr = getDaysAgoDate(todayDate, 30);

  // 7日前のスナップショット
  const snap7dRows = await db
    .select({ stars: repoSnapshots.stars })
    .from(repoSnapshots)
    .where(and(eq(repoSnapshots.repoId, repoId), eq(repoSnapshots.snapshotDate, sevenDaysAgoStr)))
    .limit(1);

  // 30日前のスナップショット
  const snap30dRows = await db
    .select({ stars: repoSnapshots.stars })
    .from(repoSnapshots)
    .where(
      and(eq(repoSnapshots.repoId, repoId), eq(repoSnapshots.snapshotDate, thirtyDaysAgoStr))
    )
    .limit(1);

  const snap7d = snap7dRows[0] ?? null;
  const snap30d = snap30dRows[0] ?? null;

  const stars7dIncrease = snap7d ? currentStars - snap7d.stars : 0;
  const stars30dIncrease = snap30d ? currentStars - snap30d.stars : 0;
  const stars7dRate =
    snap7d && snap7d.stars > 0
      ? Math.round((stars7dIncrease / snap7d.stars) * 10000) / 10000
      : 0;
  const stars30dRate =
    snap30d && snap30d.stars > 0
      ? Math.round((stars30dIncrease / snap30d.stars) * 10000) / 10000
      : 0;

  // metrics_daily にupsert（composite PKのonConflictDoUpdateはD1非対応のためDELETE+INSERT）
  await db
    .delete(metricsDaily)
    .where(and(eq(metricsDaily.repoId, repoId), eq(metricsDaily.calculatedDate, todayDate)));

  await db.insert(metricsDaily).values({
    repoId,
    calculatedDate: todayDate,
    stars7dIncrease,
    stars30dIncrease,
    stars7dRate,
    stars30dRate,
  });
}
