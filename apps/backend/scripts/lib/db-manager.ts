/**
 * データベースマネージャー
 * Drizzle ORMを使用してD1データベースにリポジトリデータを挿入する
 *
 * wranglerのgetPlatformProxyを使用してCLIスクリプトからローカル/リモートの
 * D1データベースに接続し、安全なパラメータ化クエリを実行する
 */

import { getPlatformProxy } from 'wrangler';
import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { BatchItem } from 'drizzle-orm/batch';
import { sql } from 'drizzle-orm';
import { repositories, repoSnapshots } from '../../src/db/schema.js';
import type { GitHubRepo } from './github-client.js';

export interface DbConfig {
  databaseName: string;
  useRemote: boolean;
}

export class DatabaseManager {
  private config: DbConfig;
  private db: DrizzleD1Database | null = null;
  private proxy: Awaited<ReturnType<typeof getPlatformProxy>> | null = null;

  constructor(config: DbConfig) {
    this.config = config;
  }

  /**
   * wranglerのgetPlatformProxyを使用してデータベース接続を初期化
   */
  async initialize(): Promise<void> {
    this.proxy = await getPlatformProxy({
      persist: { path: '.wrangler/state/v3' },
    });

    const d1 = this.proxy.env.DB as D1Database;
    if (!d1) {
      throw new Error(
        'D1データベースバインディングが見つかりません。wrangler.jsoncの設定を確認してください。'
      );
    }

    this.db = drizzle(d1);
  }

  /**
   * プロキシ接続をクリーンアップ
   */
  async dispose(): Promise<void> {
    if (this.proxy) {
      await this.proxy.dispose();
      this.proxy = null;
      this.db = null;
    }
  }

  /**
   * データベースインスタンスを取得
   */
  private getDb(): DrizzleD1Database {
    if (!this.db) {
      throw new Error('データベースが初期化されていません。先にinitialize()を呼び出してください。');
    }
    return this.db;
  }

  /**
   * 今日の日付をISO形式（YYYY-MM-DD）で取得
   */
  private getTodayISO(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * GitHubリポジトリデータをrepositoriesテーブル形式に変換
   */
  private transformToRepository(repo: GitHubRepo): {
    repoId: number;
    name: string;
    fullName: string;
    owner: string;
    language: string | null;
    description: string | null;
    htmlUrl: string;
    homepage: string | null;
    topics: string | null;
    createdAt: string;
    updatedAt: string;
    pushedAt: string | null;
  } {
    return {
      repoId: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      language: repo.language,
      description: repo.description,
      htmlUrl: repo.html_url,
      homepage: repo.homepage,
      topics: repo.topics.length > 0 ? JSON.stringify(repo.topics) : null,
      createdAt: repo.created_at,
      updatedAt: repo.updated_at,
      pushedAt: repo.pushed_at,
    };
  }

  /**
   * GitHubリポジトリデータをrepo_snapshotsテーブル形式に変換
   */
  private transformToSnapshot(
    repo: GitHubRepo,
    snapshotDate: string
  ): {
    repoId: number;
    stars: number;
    forks: number;
    watchers: number;
    openIssues: number;
    snapshotDate: string;
    createdAt: string;
  } {
    return {
      repoId: repo.id,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      watchers: repo.watchers_count,
      openIssues: repo.open_issues_count,
      snapshotDate,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * リポジトリとスナップショットのバッチをデータベースに保存
   * db.batch()でN+1クエリ問題を解消: 逐次O(2N)クエリ → チャンクバッチO(N/4 + N/14)クエリ
   *
   * D1パラメータ上限(100)への対応:
   * - repositories upsert: values(11列) + set(11列) = 22パラメータ/行 → 4行/チャンク
   * - repoSnapshots insert: 7列 → 14行/チャンク
   */
  async saveRepos(repos: GitHubRepo[]): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    if (repos.length === 0) {
      return { success: 0, failed: 0, errors: [] };
    }

    const db = this.getDb();
    const snapshotDate = this.getTodayISO();
    const createdAt = new Date().toISOString();

    const repoValues = repos.map((repo) => this.transformToRepository(repo));
    const snapshotValues = repos.map((repo) => ({
      repoId: repo.id,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      watchers: repo.watchers_count,
      openIssues: repo.open_issues_count,
      snapshotDate,
      createdAt,
    }));

    // D1パラメータ上限(100): values(11列) + set(11列) = 22パラメータ/行 → 4行/チャンク
    const REPO_CHUNK_SIZE = Math.floor(100 / 22); // 4行/チャンク
    // D1パラメータ上限(100): 7列
    const SNAP_CHUNK_SIZE = Math.floor(100 / 7); // 14行/チャンク

    const batchItems: BatchItem<'sqlite'>[] = [];

    for (let i = 0; i < repoValues.length; i += REPO_CHUNK_SIZE) {
      const chunk = repoValues.slice(i, i + REPO_CHUNK_SIZE);
      // excluded.column_name でINSERT対象行の値を参照（複数行バッチupsert時の各行の値を正しく反映）
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

    try {
      await db.batch(batchItems as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
      return { success: repos.length, failed: 0, errors: [] };
    } catch (error) {
      const errorMsg = `バッチ保存に失敗: ${error instanceof Error ? error.message : error}`;
      return { success: 0, failed: repos.length, errors: [errorMsg] };
    }
  }

  /**
   * 言語ごとにグループ化されたリポジトリを保存
   */
  async saveReposByLanguage(reposByLanguage: Map<string, GitHubRepo[]>): Promise<{
    totalSuccess: number;
    totalFailed: number;
    errors: string[];
  }> {
    let totalSuccess = 0;
    let totalFailed = 0;
    const allErrors: string[] = [];

    for (const [language, repos] of reposByLanguage.entries()) {
      console.log(`${repos.length}件の${language}リポジトリを保存中...`);
      const result = await this.saveRepos(repos);
      totalSuccess += result.success;
      totalFailed += result.failed;
      allErrors.push(...result.errors);

      if (result.success > 0) {
        console.log(`✓ ${result.success}/${repos.length}件の${language}リポジトリを保存`);
      }
      if (result.failed > 0) {
        console.log(`✗ ${result.failed}/${repos.length}件の${language}リポジトリが失敗`);
      }
    }

    return {
      totalSuccess,
      totalFailed,
      errors: allErrors,
    };
  }
}
