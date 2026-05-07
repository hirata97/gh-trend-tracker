/**
 * バッチ処理用データベース操作
 * リポジトリメタデータの更新、スナップショットの挿入、メトリクス計算
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { BatchItem } from 'drizzle-orm/batch';
import { eq, and } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
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

  // 7日前と30日前のスナップショットを並列取得（相互依存なし）
  const [snap7dRows, snap30dRows] = await Promise.all([
    db
      .select({ stars: repoSnapshots.stars })
      .from(repoSnapshots)
      .where(and(eq(repoSnapshots.repoId, repoId), eq(repoSnapshots.snapshotDate, sevenDaysAgoStr)))
      .limit(1),
    db
      .select({ stars: repoSnapshots.stars })
      .from(repoSnapshots)
      .where(
        and(eq(repoSnapshots.repoId, repoId), eq(repoSnapshots.snapshotDate, thirtyDaysAgoStr))
      )
      .limit(1),
  ]);

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

/**
 * 全リポジトリのメトリクスをバッチでupsertする
 * N+1クエリ問題を解消: 個別クエリO(5N)をJOINバッチ化でO(N/16 + 4)に削減
 *
 * D1のパラメータ上限(100)への対応:
 * - SELECTは自己JOINを使用（INパラメータリスト不要）
 * - DELETEはcalculated_date単一条件（パラメータ1件）
 * - INSERTは6列×16行=96パラメータ以内でチャンク分割
 */
export async function calculateAndUpsertMetricsBatch(
  db: DrizzleD1Database,
  todaySnapshots: Array<{ repoId: number; stars: number }>,
  todayDate: string
): Promise<void> {
  if (todaySnapshots.length === 0) return;

  const todayStarsMap = new Map(todaySnapshots.map((r) => [r.repoId, r.stars]));
  const sevenDaysAgoStr = getDaysAgoDate(todayDate, 7);
  const thirtyDaysAgoStr = getDaysAgoDate(todayDate, 30);

  // 自己結合エイリアス
  const snapToday = alias(repoSnapshots, 'snap_today');
  const snap7dAlias = alias(repoSnapshots, 'snap_7d');
  const snap30dAlias = alias(repoSnapshots, 'snap_30d');

  // 7日前・30日前のスナップショットを並列取得（相互依存なし、1ラウンドトリップ削減）
  const [snap7dRows, snap30dRows] = await Promise.all([
    db
      .select({ repoId: snap7dAlias.repoId, stars: snap7dAlias.stars })
      .from(snapToday)
      .innerJoin(
        snap7dAlias,
        and(
          eq(snap7dAlias.repoId, snapToday.repoId),
          eq(snap7dAlias.snapshotDate, sevenDaysAgoStr)
        )
      )
      .where(eq(snapToday.snapshotDate, todayDate)),
    db
      .select({ repoId: snap30dAlias.repoId, stars: snap30dAlias.stars })
      .from(snapToday)
      .innerJoin(
        snap30dAlias,
        and(
          eq(snap30dAlias.repoId, snapToday.repoId),
          eq(snap30dAlias.snapshotDate, thirtyDaysAgoStr)
        )
      )
      .where(eq(snapToday.snapshotDate, todayDate)),
  ]);

  const snap7dMap = new Map(snap7dRows.map((r) => [r.repoId, r.stars]));
  const snap30dMap = new Map(snap30dRows.map((r) => [r.repoId, r.stars]));

  const metricsValues = todaySnapshots.map(({ repoId }) => {
    const currentStars = todayStarsMap.get(repoId)!;
    const stars7d = snap7dMap.get(repoId) ?? null;
    const stars30d = snap30dMap.get(repoId) ?? null;

    const stars7dIncrease = stars7d !== null ? currentStars - stars7d : 0;
    const stars30dIncrease = stars30d !== null ? currentStars - stars30d : 0;
    const stars7dRate =
      stars7d !== null && stars7d > 0
        ? Math.round((stars7dIncrease / stars7d) * 10000) / 10000
        : 0;
    const stars30dRate =
      stars30d !== null && stars30d > 0
        ? Math.round((stars30dIncrease / stars30d) * 10000) / 10000
        : 0;

    return { repoId, calculatedDate: todayDate, stars7dIncrease, stars30dIncrease, stars7dRate, stars30dRate };
  });

  // composite PKのonConflictDoUpdateはD1非対応のためDELETE+INSERT
  // db.batch()でDELETE+INSERTを原子的に実行（BEGIN/COMMITはテスト環境非対応のためbatch使用）
  const INSERT_CHUNK_SIZE = Math.floor(100 / 6); // D1パラメータ上限(100): 6列×16行=96パラメータ以内
  const deleteQuery = db.delete(metricsDaily).where(eq(metricsDaily.calculatedDate, todayDate));
  const insertQueries = Array.from(
    { length: Math.ceil(metricsValues.length / INSERT_CHUNK_SIZE) },
    (_, i) => db.insert(metricsDaily).values(metricsValues.slice(i * INSERT_CHUNK_SIZE, (i + 1) * INSERT_CHUNK_SIZE))
  );
  const batchItems = [deleteQuery, ...insertQueries] as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]];
  await db.batch(batchItems);
}
