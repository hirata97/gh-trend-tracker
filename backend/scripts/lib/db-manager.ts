/**
 * Database Manager
 * Handles insertion of repository data into D1 database
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import type { GitHubRepo } from './github-client.js';

export interface DbConfig {
  databaseName: string;
  useRemote: boolean;
}

export class DatabaseManager {
  private config: DbConfig;

  constructor(config: DbConfig) {
    this.config = config;
  }

  /**
   * Get today's date in ISO format (YYYY-MM-DD)
   */
  private getTodayISO(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Escape single quotes in SQL strings
   */
  private escapeSql(value: string | null): string {
    if (value === null) return 'NULL';
    return `'${value.replace(/'/g, "''")}'`;
  }

  /**
   * Transform GitHub repo data to repository table format
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
   * Transform GitHub repo data to snapshot table format
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
   * Generate SQL INSERT statement for a repository (with UPSERT logic)
   */
  private generateRepositoryInsert(repo: GitHubRepo): string {
    const data = this.transformToRepository(repo);

    // Use INSERT OR REPLACE to handle duplicates
    return `INSERT OR REPLACE INTO repositories (
      repo_id, name, full_name, owner, language, description,
      html_url, homepage, topics, created_at, updated_at, pushed_at
    ) VALUES (
      ${data.repoId},
      ${this.escapeSql(data.name)},
      ${this.escapeSql(data.fullName)},
      ${this.escapeSql(data.owner)},
      ${this.escapeSql(data.language)},
      ${this.escapeSql(data.description)},
      ${this.escapeSql(data.htmlUrl)},
      ${this.escapeSql(data.homepage)},
      ${this.escapeSql(data.topics)},
      ${this.escapeSql(data.createdAt)},
      ${this.escapeSql(data.updatedAt)},
      ${this.escapeSql(data.pushedAt)}
    );`;
  }

  /**
   * Generate SQL INSERT statement for a snapshot (with conflict handling)
   */
  private generateSnapshotInsert(repo: GitHubRepo, snapshotDate: string): string {
    const data = this.transformToSnapshot(repo, snapshotDate);

    // Use INSERT OR IGNORE to respect UNIQUE(repo_id, snapshot_date) constraint
    return `INSERT OR IGNORE INTO repo_snapshots (
      repo_id, stars, forks, watchers, open_issues, snapshot_date, created_at
    ) VALUES (
      ${data.repoId},
      ${data.stars},
      ${data.forks},
      ${data.watchers},
      ${data.openIssues},
      ${this.escapeSql(data.snapshotDate)},
      ${this.escapeSql(data.createdAt)}
    );`;
  }

  /**
   * Execute SQL commands via wrangler CLI using a temporary file
   */
  private executeSQLFile(sqlStatements: string[]): void {
    const remoteFlag = this.config.useRemote ? '--remote' : '--local';
    const tempFile = join(process.cwd(), '.temp-insert.sql');

    try {
      // Write all SQL statements to temporary file
      const sqlContent = sqlStatements.join('\n');
      writeFileSync(tempFile, sqlContent, 'utf-8');

      // Execute via wrangler
      const command = `npx wrangler d1 execute ${this.config.databaseName} --file=${tempFile} ${remoteFlag}`;
      execSync(command, { stdio: 'inherit', cwd: process.cwd() });

      // Clean up temp file
      unlinkSync(tempFile);
    } catch (error) {
      // Clean up temp file even on error
      try {
        unlinkSync(tempFile);
      } catch {
        // Ignore cleanup errors
      }

      throw new Error(
        `Database execution failed: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Save a batch of repositories and their snapshots to the database
   * Uses bulk insert for better performance
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
    const sqlStatements: string[] = [];

    // Generate all SQL statements
    for (const repo of repos) {
      // Insert repository (upsert)
      sqlStatements.push(this.generateRepositoryInsert(repo));

      // Insert snapshot (ignore if exists)
      sqlStatements.push(this.generateSnapshotInsert(repo, snapshotDate));
    }

    // Execute all statements in one batch
    try {
      this.executeSQLFile(sqlStatements);
      return { success: repos.length, failed: 0, errors: [] };
    } catch (error) {
      const errorMsg = `Bulk insert failed: ${error instanceof Error ? error.message : error}`;
      return { success: 0, failed: repos.length, errors: [errorMsg] };
    }
  }

  /**
   * Save repos grouped by language
   */
  async saveReposByLanguage(
    reposByLanguage: Map<string, GitHubRepo[]>
  ): Promise<{
    totalSuccess: number;
    totalFailed: number;
    errors: string[];
  }> {
    let totalSuccess = 0;
    let totalFailed = 0;
    const allErrors: string[] = [];

    for (const [language, repos] of reposByLanguage.entries()) {
      console.log(`Saving ${repos.length} ${language} repositories...`);
      const result = await this.saveRepos(repos);
      totalSuccess += result.success;
      totalFailed += result.failed;
      allErrors.push(...result.errors);

      if (result.success > 0) {
        console.log(`✓ Saved ${result.success}/${repos.length} ${language} repos`);
      }
      if (result.failed > 0) {
        console.log(`✗ Failed ${result.failed}/${repos.length} ${language} repos`);
      }
    }

    return {
      totalSuccess,
      totalFailed,
      errors: allErrors,
    };
  }
}
