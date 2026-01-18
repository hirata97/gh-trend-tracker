#!/usr/bin/env tsx

/**
 * GitHubトレンドデータ収集スクリプト
 *
 * GitHub APIからトレンドリポジトリを取得し、D1データベースに保存する
 *
 * 使用方法:
 *   npm run collect              # デフォルト: ローカルデータベース
 *   npm run collect -- --remote  # リモートD1データベースを使用
 *   npm run collect -- --dry-run # 取得のみ、DBへの保存はしない
 */

import { GitHubClient } from './lib/github-client.js';
import { DatabaseManager } from './lib/db-manager.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// MVP対象言語
const TARGET_LANGUAGES = [
  'TypeScript',
  'JavaScript',
  'Python',
  'Go',
  'Rust',
  'Java',
  'C++',
  'Ruby',
  'PHP',
  'Swift',
];

// 設定
const REPOS_PER_LANGUAGE = 50;
const DATABASE_NAME = 'gh-trends-db';

interface CommandArgs {
  useRemote: boolean;
  dryRun: boolean;
}

/**
 * コマンドライン引数をパース
 */
function parseArgs(): CommandArgs {
  const args = process.argv.slice(2);
  return {
    useRemote: args.includes('--remote'),
    dryRun: args.includes('--dry-run'),
  };
}

/**
 * 環境変数を読み込み
 */
function loadEnv(): { githubToken: string } {
  // .envファイルから読み込みを試行
  try {
    const envPath = join(process.cwd(), '.env');

    if (existsSync(envPath)) {
      const envContent = readFileSync(envPath, 'utf-8');
      const envVars: Record<string, string> = {};

      envContent.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            envVars[key.trim()] = valueParts.join('=').trim();
          }
        }
      });

      if (envVars.GITHUB_TOKEN) {
        process.env.GITHUB_TOKEN = envVars.GITHUB_TOKEN;
      }
    }
  } catch (error) {
    console.warn('.envファイルの読み込みに失敗:', error);
  }

  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    throw new Error(
      'GITHUB_TOKEN環境変数が必要です。backend/.envファイルに設定してください。'
    );
  }

  return { githubToken };
}

/**
 * メイン実行関数
 */
async function main() {
  console.log('=== GitHubトレンドデータ収集 ===\n');

  // 引数をパース
  const args = parseArgs();
  console.log(`モード: ${args.dryRun ? 'DRY RUN' : args.useRemote ? 'REMOTE' : 'LOCAL'}\n`);

  // 環境変数を読み込み
  const { githubToken } = loadEnv();
  console.log('✓ 環境変数を読み込み完了\n');

  // GitHubクライアントを初期化
  const githubClient = new GitHubClient(githubToken);
  console.log('✓ GitHubクライアントを初期化完了\n');

  // リポジトリを取得
  console.log(`トレンドリポジトリを取得中（各言語${REPOS_PER_LANGUAGE}件）...\n`);
  const startTime = Date.now();

  const reposByLanguage = await githubClient.fetchMultipleLanguages(
    TARGET_LANGUAGES,
    REPOS_PER_LANGUAGE
  );

  const fetchDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✓ 取得完了（${fetchDuration}秒）\n`);

  // 合計を計算
  let totalRepos = 0;
  let successfulLanguages = 0;

  for (const repos of reposByLanguage.values()) {
    totalRepos += repos.length;
    if (repos.length > 0) {
      successfulLanguages++;
    }
  }

  console.log(`サマリー:`);
  console.log(`  - 取得リポジトリ数: ${totalRepos}`);
  console.log(`  - 成功した言語数: ${successfulLanguages}/${TARGET_LANGUAGES.length}\n`);

  // データベースに保存（dry runでない場合）
  if (args.dryRun) {
    console.log('Dry runモード - データベースへの書き込みをスキップ');
    console.log('\n言語別リポジトリ数:');
    for (const [language, repos] of reposByLanguage.entries()) {
      console.log(`  ${language}: ${repos.length}件`);
    }
    return;
  }

  // Drizzle ORMでデータベースマネージャーを初期化
  const dbManager = new DatabaseManager({
    databaseName: DATABASE_NAME,
    useRemote: args.useRemote,
  });

  try {
    console.log('データベース接続を初期化中...');
    await dbManager.initialize();
    console.log(`✓ データベースマネージャーを初期化完了（${args.useRemote ? 'リモート' : 'ローカル'}）\n`);

    // データベースに保存
    console.log('データベースに保存中...\n');
    const saveStartTime = Date.now();

    const saveResult = await dbManager.saveReposByLanguage(reposByLanguage);

    const saveDuration = ((Date.now() - saveStartTime) / 1000).toFixed(2);
    console.log(`\n✓ データベース保存完了（${saveDuration}秒）\n`);

    // 最終サマリー
    console.log('=== 最終サマリー ===');
    console.log(`取得: ${totalRepos}件`);
    console.log(`保存成功: ${saveResult.totalSuccess}件`);
    console.log(`保存失敗: ${saveResult.totalFailed}件`);

    if (saveResult.errors.length > 0) {
      console.log(`\nエラー（最初の5件）:`);
      saveResult.errors.slice(0, 5).forEach((error) => {
        console.log(`  - ${error}`);
      });
    }

    console.log('\n✓ データ収集完了！');
  } finally {
    // データベース接続をクリーンアップ
    await dbManager.dispose();
  }
}

// 実行
main().catch((error) => {
  console.error('\n✗ 致命的エラー:', error);
  process.exit(1);
});
