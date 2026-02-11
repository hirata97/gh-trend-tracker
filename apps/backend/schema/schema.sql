-- Repositories table
CREATE TABLE IF NOT EXISTS repositories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER UNIQUE NOT NULL,  -- GitHub repository ID
  name TEXT NOT NULL,
  full_name TEXT UNIQUE NOT NULL,  -- e.g., "facebook/react"
  owner TEXT NOT NULL,
  language TEXT,
  description TEXT,
  html_url TEXT NOT NULL,
  homepage TEXT,
  topics TEXT,  -- JSON array as TEXT
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  pushed_at TEXT
);

-- Repository daily snapshots
CREATE TABLE IF NOT EXISTS repo_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL,  -- References repositories.repo_id
  stars INTEGER NOT NULL DEFAULT 0,
  forks INTEGER NOT NULL DEFAULT 0,
  watchers INTEGER NOT NULL DEFAULT 0,
  open_issues INTEGER NOT NULL DEFAULT 0,
  snapshot_date TEXT NOT NULL,  -- ISO date: "2026-01-12"
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (repo_id) REFERENCES repositories(repo_id) ON DELETE CASCADE,
  UNIQUE(repo_id, snapshot_date)  -- One snapshot per repo per day
);

-- Daily metrics (pre-calculated star growth)
CREATE TABLE IF NOT EXISTS metrics_daily (
  repo_id INTEGER NOT NULL,
  calculated_date TEXT NOT NULL,
  stars_7d_increase INTEGER NOT NULL DEFAULT 0,
  stars_30d_increase INTEGER NOT NULL DEFAULT 0,
  stars_7d_rate REAL NOT NULL DEFAULT 0.0,
  stars_30d_rate REAL NOT NULL DEFAULT 0.0,
  PRIMARY KEY (repo_id, calculated_date),
  FOREIGN KEY (repo_id) REFERENCES repositories(repo_id) ON DELETE CASCADE
);

-- Weekly ranking aggregation
CREATE TABLE IF NOT EXISTS ranking_weekly (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  language TEXT NOT NULL DEFAULT 'all',
  rank_data TEXT NOT NULL,  -- JSON array of ranking entries
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(year, week_number, language)
);

CREATE INDEX IF NOT EXISTS idx_ranking_weekly_year_week ON ranking_weekly(year DESC, week_number DESC);

-- Language master data
CREATE TABLE IF NOT EXISTS languages (
  code TEXT PRIMARY KEY NOT NULL,
  name_ja TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 100
);

-- Initial language data
INSERT OR IGNORE INTO languages (code, name_ja, sort_order) VALUES
  ('all', 'すべて', 0),
  ('TypeScript', 'TypeScript', 1),
  ('Python', 'Python', 2),
  ('JavaScript', 'JavaScript', 3),
  ('Go', 'Go', 4),
  ('Rust', 'Rust', 5),
  ('Java', 'Java', 6);

-- Users table (Phase 3: Authentication & Billing)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,  -- UUID
  github_id INTEGER UNIQUE NOT NULL,
  username TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  plan TEXT NOT NULL DEFAULT 'FREE',  -- 'FREE', 'PRO', 'ENTERPRISE'
  credits_remaining INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id TEXT UNIQUE,
  subscription_expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe ON users(stripe_customer_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_repos_language ON repositories(language);
CREATE INDEX IF NOT EXISTS idx_repos_updated ON repositories(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON repo_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_repo ON repo_snapshots(repo_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_date ON metrics_daily(calculated_date DESC);
