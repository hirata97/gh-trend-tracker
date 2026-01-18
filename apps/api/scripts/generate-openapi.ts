/**
 * OpenAPI仕様書生成スクリプト
 *
 * このスクリプトはZodスキーマからOpenAPI 3.0仕様書を生成し、
 * docs/openapi.yamlに出力します。
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { OpenAPIHono } from '@hono/zod-openapi';

import {
  healthRoute,
  getAllTrendsRoute,
  getTrendsByLanguageRoute,
  getRepositoryHistoryRoute,
  getLanguagesRoute,
} from '../src/openapi/index';

// 簡易的なHonoアプリを作成してOpenAPI仕様を生成
const app = new OpenAPIHono();

// ダミーハンドラでルートを登録
app.openapi(healthRoute, (c) => c.json({}, 200));
app.openapi(getAllTrendsRoute, (c) => c.json({}, 200));
app.openapi(getTrendsByLanguageRoute, (c) => c.json({}, 200));
app.openapi(getRepositoryHistoryRoute, (c) => c.json({}, 200));
app.openapi(getLanguagesRoute, (c) => c.json({}, 200));

// OpenAPI仕様を取得
const openApiSpec = app.getOpenAPIDocument({
  openapi: '3.0.0',
  info: {
    title: 'GitHub Trend Tracker API',
    version: '1.0.0',
    description: `GitHubリポジトリのトレンドを取得するAPI

## 概要
GitHub Trend Tracker APIは、GitHubリポジトリのトレンド情報を提供します。
トレンドデータは日次で収集され、過去90日間の履歴を参照できます。

## 主な機能
- 全言語のトレンドリポジトリ取得
- 言語別トレンドリポジトリ取得
- リポジトリの履歴データ取得
- 対応言語一覧の取得

## 制限事項
- トレンドエンドポイント: 上位100件まで
- 履歴エンドポイント: 過去90日間まで

## エラーレスポンス
すべてのエンドポイントは、エラー発生時に以下の形式でレスポンスを返します:

\`\`\`json
{
  "error": "エラーメッセージ",
  "code": "ERROR_CODE",
  "traceId": "abc123-def456"
}
\`\`\`

### エラーコード一覧
- \`VALIDATION_ERROR\`: 入力バリデーションエラー
- \`NOT_FOUND\`: リソースが見つからない
- \`DB_ERROR\`: データベースエラー
- \`INTERNAL_ERROR\`: 内部サーバーエラー
`,
    contact: {
      name: 'GitHub Trend Tracker',
      url: 'https://github.com/hirata97/gh-trend-tracker',
    },
    license: {
      name: 'MIT',
    },
  },
  servers: [
    {
      url: 'https://gh-trend-tracker.{user}.workers.dev',
      description: 'Production server',
      variables: {
        user: {
          default: 'your-username',
          description: 'Cloudflare Workersのユーザー名',
        },
      },
    },
    {
      url: 'http://localhost:8787',
      description: 'Local development server',
    },
  ],
  tags: [
    {
      name: 'Health',
      description: 'ヘルスチェックエンドポイント',
    },
    {
      name: 'Trends',
      description: 'トレンドリポジトリ取得エンドポイント',
    },
    {
      name: 'Repositories',
      description: 'リポジトリ情報取得エンドポイント',
    },
    {
      name: 'Languages',
      description: '言語一覧取得エンドポイント',
    },
  ],
});

// JSONからYAMLへの簡易変換
function jsonToYaml(obj: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent);

  if (obj === null) {
    return 'null';
  }

  if (typeof obj === 'undefined') {
    return '';
  }

  if (typeof obj === 'string') {
    // 複数行の文字列はリテラルブロックスカラーを使用
    if (obj.includes('\n')) {
      const lines = obj.split('\n');
      return `|\n${lines.map(line => spaces + '  ' + line).join('\n')}`;
    }
    // 特殊文字を含む場合はクォート
    if (obj.match(/[:#\[\]{}&*!|>'"@`]/)) {
      return `"${obj.replace(/"/g, '\\"')}"`;
    }
    return obj;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return '[]';
    }
    return obj.map(item => {
      const itemYaml = jsonToYaml(item, indent + 1);
      if (typeof item === 'object' && item !== null) {
        return `${spaces}- ${itemYaml.trimStart()}`;
      }
      return `${spaces}- ${itemYaml}`;
    }).join('\n');
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj);
    if (entries.length === 0) {
      return '{}';
    }
    return entries.map(([key, value]) => {
      const valueYaml = jsonToYaml(value, indent + 1);
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return `${spaces}${key}:\n${valueYaml}`;
      }
      if (Array.isArray(value) && value.length > 0) {
        return `${spaces}${key}:\n${valueYaml}`;
      }
      return `${spaces}${key}: ${valueYaml}`;
    }).join('\n');
  }

  return '';
}

// 出力先ディレクトリ
const outputDir = join(dirname(__dirname), '..', '..', 'docs');
const outputPath = join(outputDir, 'openapi.yaml');

// ディレクトリが存在しない場合は作成
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

// YAML形式で出力
const yamlContent = jsonToYaml(openApiSpec);
writeFileSync(outputPath, yamlContent, 'utf-8');

console.log(`OpenAPI specification generated: ${outputPath}`);

// JSON形式でも出力（検証用）
const jsonOutputPath = join(outputDir, 'openapi.json');
writeFileSync(jsonOutputPath, JSON.stringify(openApiSpec, null, 2), 'utf-8');
console.log(`OpenAPI specification (JSON) generated: ${jsonOutputPath}`);
