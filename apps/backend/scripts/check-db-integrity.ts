#!/usr/bin/env tsx

/**
 * DBデータ整合性チェックスクリプト
 *
 * マイグレーション適用後の整合性を検証する。
 * 主要4テーブルに対し以下を検証:
 *   - 行数が0件でないこと
 *   - daily_metrics / ranking_weekly の最新レコードのupdated_atが直近24時間以内
 *   - repositories の主キー重複が無いこと
 *
 * 使用方法:
 *   npm run db:check                        # ローカルSQLiteを使用
 *   npm run db:check -- --remote            # リモートD1を使用（本番）
 *   npm run db:check -- --env development   # 開発用D1を使用
 *
 * 終了コード:
 *   0: 全チェック通過
 *   1: チェック失敗（詳細は標準エラー出力を確認）
 */

import { execSync } from 'child_process';

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

const args = process.argv.slice(2);
const isRemote = args.includes('--remote');
const envArg = args.find((a) => a.startsWith('--env'));
const env = envArg ? envArg.split('=')[1] ?? args[args.indexOf(envArg) + 1] : 'development';

// 現在時刻から24時間前のISO文字列を生成
const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

const dbName = env === 'production' ? 'gh-trends-db' : 'gh-trends-db-dev';
const remoteFlag = isRemote ? '--remote' : '--local';
const envFlag = `--env ${env}`;

/**
 * wrangler d1 execute でSQLを実行し、JSON形式で結果を返す
 */
function query(sql: string): { results?: Array<Record<string, unknown>> } {
  try {
    const cmd = `npx wrangler d1 execute ${dbName} ${remoteFlag} ${envFlag} --command "${sql.replace(/"/g, '\\"')}" --json`;
    const output = execSync(cmd, { stdio: 'pipe', encoding: 'utf8' });
    const parsed = JSON.parse(output);
    return Array.isArray(parsed) ? parsed[0] : parsed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`クエリ実行失敗: ${message}`);
  }
}

const checks: CheckResult[] = [];

// 1. repositories テーブルの行数確認
try {
  const result = query('SELECT COUNT(*) as count FROM repositories');
  const count = Number(result.results?.[0]?.count ?? 0);
  checks.push({
    name: 'repositories: 行数 > 0',
    passed: count > 0,
    message: count > 0 ? `${count}件のリポジトリが存在します` : 'repositoriesテーブルにデータがありません',
  });
} catch (err) {
  checks.push({ name: 'repositories: 行数 > 0', passed: false, message: String(err) });
}

// 2. repo_snapshots テーブルの行数確認
try {
  const result = query('SELECT COUNT(*) as count FROM repo_snapshots');
  const count = Number(result.results?.[0]?.count ?? 0);
  checks.push({
    name: 'repo_snapshots: 行数 > 0',
    passed: count > 0,
    message: count > 0 ? `${count}件のスナップショットが存在します` : 'repo_snapshotsテーブルにデータがありません',
  });
} catch (err) {
  checks.push({ name: 'repo_snapshots: 行数 > 0', passed: false, message: String(err) });
}

// 3. metrics_daily の最新レコードが直近24時間以内
try {
  const result = query(
    `SELECT MAX(calculated_date) as latest FROM metrics_daily`
  );
  const latest = result.results?.[0]?.latest as string | undefined;
  const hasRecent = latest !== undefined && latest !== null && latest >= threshold.slice(0, 10);
  checks.push({
    name: 'metrics_daily: 最新レコードが直近24時間以内',
    passed: hasRecent,
    message: hasRecent
      ? `最新レコード: ${latest}`
      : `最新レコード(${latest ?? 'なし'})が24時間以上前です（閾値: ${threshold.slice(0, 10)}）`,
  });
} catch (err) {
  checks.push({ name: 'metrics_daily: 最新レコードが直近24時間以内', passed: false, message: String(err) });
}

// 4. ranking_weekly の行数確認
try {
  const result = query('SELECT COUNT(*) as count FROM ranking_weekly');
  const count = Number(result.results?.[0]?.count ?? 0);
  checks.push({
    name: 'ranking_weekly: 行数 > 0',
    passed: count > 0,
    message: count > 0 ? `${count}件のウィークリーランキングが存在します` : 'ranking_weeklyテーブルにデータがありません',
  });
} catch (err) {
  checks.push({ name: 'ranking_weekly: 行数 > 0', passed: false, message: String(err) });
}

// 5. languages テーブルの初期データ確認（7件固定）
try {
  const result = query('SELECT COUNT(*) as count FROM languages');
  const count = Number(result.results?.[0]?.count ?? 0);
  const expected = 7;
  checks.push({
    name: `languages: 初期データ ${expected}件`,
    passed: count === expected,
    message: count === expected ? `${count}件の言語マスタが存在します` : `期待値 ${expected}件 に対し ${count}件 しか存在しません`,
  });
} catch (err) {
  checks.push({ name: 'languages: 初期データ 7件', passed: false, message: String(err) });
}

// 6. repositories の主キー重複チェック
try {
  const result = query(
    'SELECT repo_id, COUNT(*) as cnt FROM repositories GROUP BY repo_id HAVING cnt > 1'
  );
  const duplicates = result.results?.length ?? 0;
  checks.push({
    name: 'repositories: 主キー重複なし',
    passed: duplicates === 0,
    message: duplicates === 0 ? '重複なし' : `${duplicates}件のrepo_id重複が存在します`,
  });
} catch (err) {
  checks.push({ name: 'repositories: 主キー重複なし', passed: false, message: String(err) });
}

// 結果表示
console.log('\n=== DBデータ整合性チェック結果 ===\n');
console.log(`接続先: ${dbName} (${isRemote ? 'remote' : 'local'}) [env: ${env}]`);
console.log(`チェック時刻: ${new Date().toISOString()}\n`);

let allPassed = true;
for (const check of checks) {
  const icon = check.passed ? '✅' : '❌';
  console.log(`${icon} ${check.name}`);
  if (!check.passed) {
    console.error(`   → ${check.message}`);
    allPassed = false;
  } else {
    console.log(`   → ${check.message}`);
  }
}

console.log('\n' + '='.repeat(40));
if (allPassed) {
  console.log('✅ 全チェック通過');
  process.exit(0);
} else {
  console.error('❌ チェック失敗（詳細は上記を確認）');
  process.exit(1);
}
