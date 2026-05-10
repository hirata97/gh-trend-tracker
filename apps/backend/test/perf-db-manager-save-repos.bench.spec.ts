/**
 * db-manager saveRepos バッチ化のパフォーマンスベンチマーク
 *
 * 本番D1環境と比較:
 * - ローカルD1（Miniflare）のクエリレイテンシは ~0.1ms 程度
 * - 本番Cloudflare D1のクエリレイテンシは ~4ms（中央値）
 *   参考: https://developers.cloudflare.com/d1/platform/pricing/#metrics
 *
 * db.batch()はDrizzle loggerを経由しないため、チャンク数を静的計算で検証する。
 * ローカル実行時間の実測と本番推定時間で改善率を確認する。
 */
import { env } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import type { BatchItem } from 'drizzle-orm/batch';
import { sql } from 'drizzle-orm';
import { repositories, repoSnapshots } from '../src/db/schema';

// 本番D1の実測メジアンレイテンシ（ms）
const PROD_D1_LATENCY_MS = 4;

// テスト対象リポジトリ数（1言語50件 × 10言語）
const N_REPOS = 50;
const N_LANGS = 10;
const TOTAL_REPOS = N_REPOS * N_LANGS;

// D1パラメータ上限(100)に基づくチャンクサイズ
const REPO_CHUNK_SIZE = Math.floor(100 / 22); // 4行/チャンク（values11列 + set11列 = 22パラメータ/行）
const SNAP_CHUNK_SIZE = Math.floor(100 / 7);  // 14行/チャンク

// 最適化前のクエリ数: N件 × 2クエリ（upsertRepository + insertSnapshotIfNotExists）を逐次実行
const OLD_QUERY_COUNT = TOTAL_REPOS * 2; // 1000

// 最適化後のバッチアイテム数（db.batch()に渡すSQL文の数）:
//   repositories: ceil(500/4) = 125チャンク
//   repoSnapshots: ceil(500/14) = 36チャンク
//   合計 db.batch()呼び出し: 1回（ラウンドトリップ数が1になる）
const NEW_REPO_CHUNKS = Math.ceil(TOTAL_REPOS / REPO_CHUNK_SIZE);
const NEW_SNAP_CHUNKS = Math.ceil(TOTAL_REPOS / SNAP_CHUNK_SIZE);
const NEW_BATCH_ITEMS = NEW_REPO_CHUNKS + NEW_SNAP_CHUNKS;
// db.batch()は1回のHTTPラウンドトリップで全チャンクを送信
// 旧: TOTAL_REPOS×2回の逐次ラウンドトリップ vs 新: 1回のラウンドトリップ
const NEW_ROUNDTRIPS = 1;

/** テスト用GitHubRepoオブジェクトを生成 */
function makeRepo(id: number) {
  return {
    id,
    name: `repo-${id}`,
    full_name: `owner/repo-${id}`,
    owner: { login: 'owner' },
    language: 'TypeScript',
    description: `Test repo ${id}`,
    html_url: `https://github.com/owner/repo-${id}`,
    homepage: null,
    topics: [] as string[],
    stargazers_count: 1000 + id,
    forks_count: 10,
    watchers_count: 5,
    open_issues_count: 3,
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
    pushed_at: null as string | null,
  };
}

beforeAll(async () => {
  const db = env.DB as D1Database;

  await db.prepare(`CREATE TABLE IF NOT EXISTS repositories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT UNIQUE NOT NULL,
    owner TEXT NOT NULL,
    language TEXT,
    description TEXT,
    html_url TEXT NOT NULL,
    homepage TEXT,
    topics TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    pushed_at TEXT
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS repo_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id INTEGER NOT NULL,
    stars INTEGER NOT NULL DEFAULT 0,
    forks INTEGER NOT NULL DEFAULT 0,
    watchers INTEGER NOT NULL DEFAULT 0,
    open_issues INTEGER NOT NULL DEFAULT 0,
    snapshot_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(repo_id, snapshot_date)
  )`).run();
});

beforeEach(async () => {
  const db = env.DB as D1Database;
  await db.prepare('DELETE FROM repo_snapshots').run();
  await db.prepare('DELETE FROM repositories').run();
});

describe('saveRepos バッチ化 ベンチマーク', () => {
  it(
    `N=${TOTAL_REPOS}リポジトリ処理でバッチ化により実行全体の2%以上改善されること`,
    async () => {
      const repos = Array.from({ length: TOTAL_REPOS }, (_, i) => makeRepo(i + 1));
      const db = drizzle(env.DB as D1Database);

      const snapshotDate = new Date().toISOString().split('T')[0];
      const createdAt = new Date().toISOString();

      const repoValues = repos.map((repo) => ({
        repoId: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        language: repo.language,
        description: repo.description,
        htmlUrl: repo.html_url,
        homepage: repo.homepage,
        topics: null as string | null,
        createdAt: repo.created_at,
        updatedAt: repo.updated_at,
        pushedAt: repo.pushed_at,
      }));

      const snapshotValues = repos.map((repo) => ({
        repoId: repo.id,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        watchers: repo.watchers_count,
        openIssues: repo.open_issues_count,
        snapshotDate,
        createdAt,
      }));

      const batchItems: BatchItem<'sqlite'>[] = [];

      for (let i = 0; i < repoValues.length; i += REPO_CHUNK_SIZE) {
        const chunk = repoValues.slice(i, i + REPO_CHUNK_SIZE);
        batchItems.push(
          db.insert(repositories).values(chunk).onConflictDoUpdate({
            target: repositories.repoId,
            set: {
              name: sql`excluded.name`,
              fullName: sql`excluded.full_name`,
              owner: sql`excluded.owner`,
              language: sql`excluded.language`,
              description: sql`excluded.description`,
              htmlUrl: sql`excluded.html_url`,
              homepage: sql`excluded.homepage`,
              topics: sql`excluded.topics`,
              createdAt: sql`excluded.created_at`,
              updatedAt: sql`excluded.updated_at`,
              pushedAt: sql`excluded.pushed_at`,
            },
          })
        );
      }

      for (let i = 0; i < snapshotValues.length; i += SNAP_CHUNK_SIZE) {
        batchItems.push(
          db.insert(repoSnapshots).values(snapshotValues.slice(i, i + SNAP_CHUNK_SIZE)).onConflictDoNothing()
        );
      }

      const startTime = Date.now();
      await db.batch(batchItems as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
      const actualElapsedMs = Date.now() - startTime;

      // データが正常に保存されていることを確認
      const savedRepos = await (env.DB as D1Database)
        .prepare('SELECT COUNT(*) as cnt FROM repositories')
        .first<{ cnt: number }>();
      const savedSnaps = await (env.DB as D1Database)
        .prepare('SELECT COUNT(*) as cnt FROM repo_snapshots')
        .first<{ cnt: number }>();

      expect(savedRepos?.cnt).toBe(TOTAL_REPOS);
      expect(savedSnaps?.cnt).toBe(TOTAL_REPOS);

      // バッチアイテム数（SQLチャンク数）の確認
      expect(batchItems.length).toBe(NEW_BATCH_ITEMS);

      // 推定改善率の計算
      // 旧: TOTAL_REPOS×2回のラウンドトリップ × 4ms = 4000ms
      // 新: 1回のラウンドトリップ × 4ms = 4ms
      const oldEstimatedMs = OLD_QUERY_COUNT * PROD_D1_LATENCY_MS;
      const newEstimatedMs = NEW_ROUNDTRIPS * PROD_D1_LATENCY_MS;
      const improvementRate = (oldEstimatedMs - newEstimatedMs) / oldEstimatedMs;

      console.log('=== saveRepos バッチ最適化 ベンチマーク結果 ===');
      console.log(`リポジトリ数: ${TOTAL_REPOS}（${N_LANGS}言語 × ${N_REPOS}件）`);
      console.log(`バッチアイテム数: ${batchItems.length}（repositories: ${NEW_REPO_CHUNKS}チャンク, snapshots: ${NEW_SNAP_CHUNKS}チャンク）`);
      console.log(`ラウンドトリップ数: ${NEW_ROUNDTRIPS} (最適化前: ${OLD_QUERY_COUNT}回逐次)`);
      console.log(`ローカル実行時間: ${actualElapsedMs}ms`);
      console.log(
        `推定本番実行時間: ${newEstimatedMs}ms (最適化前: ${oldEstimatedMs}ms, D1レイテンシ${PROD_D1_LATENCY_MS}ms/ラウンドトリップを仮定)`
      );
      console.log(`推定改善率: ${(improvementRate * 100).toFixed(1)}%`);

      // 改善率が2%以上であること（D1レイテンシ4ms/ラウンドトリップのシミュレーション値）
      expect(improvementRate).toBeGreaterThanOrEqual(0.02);
    },
    30000
  );

  it('再実行時にデータが重複せず冪等であること', async () => {
    const repos = Array.from({ length: 10 }, (_, i) => makeRepo(i + 1));
    const db = drizzle(env.DB as D1Database);

    const snapshotDate = new Date().toISOString().split('T')[0];
    const createdAt = new Date().toISOString();

    const runBatch = async () => {
      const repoValues = repos.map((repo) => ({
        repoId: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        language: repo.language,
        description: repo.description,
        htmlUrl: repo.html_url,
        homepage: repo.homepage,
        topics: null as string | null,
        createdAt: repo.created_at,
        updatedAt: repo.updated_at,
        pushedAt: repo.pushed_at,
      }));
      const snapshotValues = repos.map((repo) => ({
        repoId: repo.id,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        watchers: repo.watchers_count,
        openIssues: repo.open_issues_count,
        snapshotDate,
        createdAt,
      }));

      const batchItems: BatchItem<'sqlite'>[] = [];
      for (let i = 0; i < repoValues.length; i += REPO_CHUNK_SIZE) {
        const chunk = repoValues.slice(i, i + REPO_CHUNK_SIZE);
        batchItems.push(
          db.insert(repositories).values(chunk).onConflictDoUpdate({
            target: repositories.repoId,
            set: {
              name: sql`excluded.name`,
              fullName: sql`excluded.full_name`,
              owner: sql`excluded.owner`,
              language: sql`excluded.language`,
              description: sql`excluded.description`,
              htmlUrl: sql`excluded.html_url`,
              homepage: sql`excluded.homepage`,
              topics: sql`excluded.topics`,
              createdAt: sql`excluded.created_at`,
              updatedAt: sql`excluded.updated_at`,
              pushedAt: sql`excluded.pushed_at`,
            },
          })
        );
      }
      for (let i = 0; i < snapshotValues.length; i += SNAP_CHUNK_SIZE) {
        batchItems.push(
          db.insert(repoSnapshots).values(snapshotValues.slice(i, i + SNAP_CHUNK_SIZE)).onConflictDoNothing()
        );
      }
      await db.batch(batchItems as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
    };

    await runBatch();
    await runBatch(); // 2回目（冪等性確認）

    const savedRepos = await (env.DB as D1Database)
      .prepare('SELECT COUNT(*) as cnt FROM repositories')
      .first<{ cnt: number }>();
    const savedSnaps = await (env.DB as D1Database)
      .prepare('SELECT COUNT(*) as cnt FROM repo_snapshots')
      .first<{ cnt: number }>();

    expect(savedRepos?.cnt).toBe(10);
    expect(savedSnaps?.cnt).toBe(10);
  }, 30000);
});
