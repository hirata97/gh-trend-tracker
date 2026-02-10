/**
 * RepositoryListItem コンポーネント (COM-001)
 * リポジトリ1件をカード/行として表示する。
 * 使用箇所: scr-001, scr-003, scr-004, scr-010
 */

import MetricsBadge from './MetricsBadge';

interface RepositoryListItemProps {
  repo: {
    id: string;
    full_name: string;
    description: string | null;
    language: string | null;
    stargazers_count: number;
    forks_count: number;
  };
  metrics?: {
    stars_7d_increase: number;
    stars_30d_increase: number;
  };
  showMetrics?: boolean;
  onFavoriteToggle?: (repoId: string) => void;
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return num.toLocaleString();
}

export default function RepositoryListItem({
  repo,
  metrics,
  showMetrics = false,
  onFavoriteToggle,
}: RepositoryListItemProps) {
  return (
    <div className="repo-list-item">
      <div className="repo-list-item__header">
        <a href={`/repo/${repo.id}`} className="repo-list-item__name">
          {repo.full_name}
        </a>
        {repo.language && <span className="language-badge">{repo.language}</span>}
        {onFavoriteToggle && (
          <button
            className="repo-list-item__favorite"
            onClick={() => onFavoriteToggle(repo.id)}
            aria-label="Toggle favorite"
            title="Toggle favorite"
          >
            &#9734;
          </button>
        )}
      </div>

      {repo.description && <p className="repo-list-item__description">{repo.description}</p>}

      <div className="repo-list-item__stats">
        <span className="repo-list-item__stat" title="Stars">
          &#9733; {formatNumber(repo.stargazers_count)}
        </span>
        <span className="repo-list-item__stat" title="Forks">
          &#9741; {formatNumber(repo.forks_count)}
        </span>

        {showMetrics && metrics && (
          <div className="metrics-badge-group">
            <MetricsBadge value={metrics.stars_7d_increase} period="7d" />
            <MetricsBadge value={metrics.stars_30d_increase} period="30d" />
          </div>
        )}
      </div>
    </div>
  );
}
