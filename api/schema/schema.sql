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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_repos_language ON repositories(language);
CREATE INDEX IF NOT EXISTS idx_repos_updated ON repositories(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON repo_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_repo ON repo_snapshots(repo_id, snapshot_date DESC);
