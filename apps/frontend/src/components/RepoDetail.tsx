/**
 * RepoDetail Component
 * Displays detailed repository information with stats and star history chart
 */

import type { RepoDetailResponse } from '@gh-trend-tracker/shared';
import StarChart from './StarChart';
import FavoriteButton from './FavoriteButton';
import { useFavorites } from '../hooks/useFavorites';

interface ChartData {
  date: string;
  stars: number;
}

interface Props {
  detail: RepoDetailResponse;
  history: ChartData[];
}

function formatGrowthRate(rate: number | null): string {
  if (rate === null) return '-';
  const sign = rate >= 0 ? '+' : '';
  return `${sign}${rate.toFixed(2)}%`;
}

function formatGrowth(growth: number | null): string {
  if (growth === null) return '-';
  const sign = growth >= 0 ? '+' : '';
  return `${sign}${growth.toLocaleString()}`;
}

function getGrowthClass(rate: number | null): string {
  if (rate === null) return 'growth-neutral';
  if (rate >= 5) return 'growth-high';
  if (rate >= 1) return 'growth-medium';
  return 'growth-low';
}

export default function RepoDetail({ detail, history }: Props) {
  const { repository, currentStats, weeklyGrowth, weeklyGrowthRate } = detail;
  const { isFavorite, toggleFavorite } = useFavorites();

  return (
    <div className="repo-detail">
      <header className="repo-header">
        <div className="repo-title-row">
          <h1>
            <a href={repository.htmlUrl} target="_blank" rel="noopener noreferrer">
              {repository.fullName}
            </a>
          </h1>
          <FavoriteButton
            repo={{ id: String(repository.repoId), full_name: repository.fullName }}
            isFavorite={isFavorite(String(repository.repoId))}
            onToggle={toggleFavorite}
            size="large"
          />
        </div>
        {repository.description && <p className="repo-description">{repository.description}</p>}
        <div className="repo-meta">
          {repository.language && <span className="language-badge">{repository.language}</span>}
          {repository.homepage && (
            <a
              href={repository.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="homepage-link"
            >
              Homepage
            </a>
          )}
        </div>
        {repository.topics.length > 0 && (
          <div className="topics">
            {repository.topics.map((topic) => (
              <span key={topic} className="topic-badge">
                {topic}
              </span>
            ))}
          </div>
        )}
      </header>

      <section className="repo-stats">
        <h2>Current Stats</h2>
        {currentStats ? (
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">{currentStats.stars.toLocaleString()}</span>
              <span className="stat-label">Stars</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{currentStats.forks.toLocaleString()}</span>
              <span className="stat-label">Forks</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{currentStats.watchers.toLocaleString()}</span>
              <span className="stat-label">Watchers</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{currentStats.openIssues.toLocaleString()}</span>
              <span className="stat-label">Open Issues</span>
            </div>
            <div className={`stat-item ${getGrowthClass(weeklyGrowthRate)}`}>
              <span className="stat-value">
                {formatGrowth(weeklyGrowth)} ({formatGrowthRate(weeklyGrowthRate)})
              </span>
              <span className="stat-label">Weekly Growth</span>
            </div>
          </div>
        ) : (
          <p className="no-stats">No statistics available</p>
        )}
      </section>

      <section className="repo-chart">
        <h2>Star History (Last 90 Days)</h2>
        <StarChart data={history} />
      </section>
    </div>
  );
}
