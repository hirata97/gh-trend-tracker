#!/usr/bin/env tsx

/**
 * GitHub Trends Data Collection Script
 *
 * Fetches trending repositories from GitHub API and stores them in D1 database
 *
 * Usage:
 *   npm run collect              # Default: local database
 *   npm run collect -- --remote  # Use remote D1 database
 *   npm run collect -- --dry-run # Fetch only, don't save to DB
 */

import { GitHubClient } from './lib/github-client.js';
import { DatabaseManager } from './lib/db-manager.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Target languages for MVP
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

// Configuration
const REPOS_PER_LANGUAGE = 50;
const DATABASE_NAME = 'gh-trends-db';

interface CommandArgs {
  useRemote: boolean;
  dryRun: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): CommandArgs {
  const args = process.argv.slice(2);
  return {
    useRemote: args.includes('--remote'),
    dryRun: args.includes('--dry-run'),
  };
}

/**
 * Load environment variables
 */
function loadEnv(): { githubToken: string } {
  // Try to load from .env file
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
    console.warn('Could not load .env file:', error);
  }

  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    throw new Error(
      'GITHUB_TOKEN environment variable is required. Please set it in backend/.env file.'
    );
  }

  return { githubToken };
}

/**
 * Main execution function
 */
async function main() {
  console.log('=== GitHub Trends Data Collection ===\n');

  // Parse arguments
  const args = parseArgs();
  console.log(`Mode: ${args.dryRun ? 'DRY RUN' : args.useRemote ? 'REMOTE' : 'LOCAL'}\n`);

  // Load environment
  const { githubToken } = loadEnv();
  console.log('✓ Environment loaded\n');

  // Initialize GitHub client
  const githubClient = new GitHubClient(githubToken);
  console.log('✓ GitHub client initialized\n');

  // Fetch repositories
  console.log(`Fetching trending repositories (${REPOS_PER_LANGUAGE} per language)...\n`);
  const startTime = Date.now();

  const reposByLanguage = await githubClient.fetchMultipleLanguages(
    TARGET_LANGUAGES,
    REPOS_PER_LANGUAGE
  );

  const fetchDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✓ Fetching completed in ${fetchDuration}s\n`);

  // Calculate totals
  let totalRepos = 0;
  let successfulLanguages = 0;

  for (const [language, repos] of reposByLanguage.entries()) {
    totalRepos += repos.length;
    if (repos.length > 0) {
      successfulLanguages++;
    }
  }

  console.log(`Summary:`);
  console.log(`  - Total repos fetched: ${totalRepos}`);
  console.log(`  - Successful languages: ${successfulLanguages}/${TARGET_LANGUAGES.length}\n`);

  // Save to database (unless dry run)
  if (args.dryRun) {
    console.log('Dry run mode - skipping database writes.');
    console.log('\nRepos by language:');
    for (const [language, repos] of reposByLanguage.entries()) {
      console.log(`  ${language}: ${repos.length} repos`);
    }
    return;
  }

  // Initialize database manager
  const dbManager = new DatabaseManager({
    databaseName: DATABASE_NAME,
    useRemote: args.useRemote,
  });
  console.log(`✓ Database manager initialized (${args.useRemote ? 'remote' : 'local'})\n`);

  // Save to database
  console.log('Saving to database...\n');
  const saveStartTime = Date.now();

  const saveResult = await dbManager.saveReposByLanguage(reposByLanguage);

  const saveDuration = ((Date.now() - saveStartTime) / 1000).toFixed(2);
  console.log(`\n✓ Database save completed in ${saveDuration}s\n`);

  // Final summary
  console.log('=== Final Summary ===');
  console.log(`Fetched: ${totalRepos} repos`);
  console.log(`Saved: ${saveResult.totalSuccess} repos`);
  console.log(`Failed: ${saveResult.totalFailed} repos`);

  if (saveResult.errors.length > 0) {
    console.log(`\nErrors (showing first 5):`);
    saveResult.errors.slice(0, 5).forEach((error) => {
      console.log(`  - ${error}`);
    });
  }

  console.log('\n✓ Data collection complete!');
}

// Execute
main().catch((error) => {
  console.error('\n✗ Fatal error:', error);
  process.exit(1);
});
