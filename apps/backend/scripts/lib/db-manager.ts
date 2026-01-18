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
      throw new Error('D1データベースバインディングが見つかりません。wrangler.jsoncの設定を確認してください。');
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
   * Drizzle ORMを使用してリポジトリを挿入または更新（upsert）
   */
  private async upsertRepository(repo: GitHubRepo): Promise<void> {
    const db = this.getDb();
    const data = this.transformToRepository(repo);

    // SQLiteのupsert動作のためINSERT OR REPLACEを使用
    await db.insert(repositories).values(data).onConflictDoUpdate({
      target: repositories.repoId,
      set: {
        name: data.name,
        fullName: data.fullName,
        owner: data.owner,
        language: data.language,
        description: data.description,
        htmlUrl: data.htmlUrl,
        homepage: data.homepage,
        topics: data.topics,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        pushedAt: data.pushedAt,
      },
    });
  }

  /**
   * Drizzle ORMを使用してスナップショットを挿入（重複は無視）
   */
  private async insertSnapshotIfNotExists(repo: GitHubRepo, snapshotDate: string): Promise<void> {
    const db = this.getDb();
    const data = this.transformToSnapshot(repo, snapshotDate);

    // SQLiteのINSERT OR IGNOREを使用 - 重複キーが存在する場合は無視
    await db.insert(repoSnapshots).values(data).onConflictDoNothing();
  }

  /**
   * リポジトリとスナップショットのバッチをデータベースに保存
   * Drizzle ORMによる安全なパラメータ化クエリを使用
   */
  async saveRepos(repos: GitHubRepo[]): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    if (repos.length === 0) {
      return { success: 0, failed: 0, errors: [] };
    }

    const snapshotDate = this.getTodayISO();
    let successCount = 0;
    const errors: string[] = [];

    for (const repo of repos) {
      try {
        // リポジトリをupsert
        await this.upsertRepository(repo);

        // スナップショットを挿入（既存の場合は無視）
        await this.insertSnapshotIfNotExists(repo, snapshotDate);

        successCount++;
      } catch (error) {
        const errorMsg = `リポジトリ ${repo.full_name} の保存に失敗: ${error instanceof Error ? error.message : error}`;
        errors.push(errorMsg);
      }
    }

    return {
      success: successCount,
      failed: repos.length - successCount,
      errors,
    };
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
