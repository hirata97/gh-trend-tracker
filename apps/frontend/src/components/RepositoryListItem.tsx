/**
 * RepositoryListItem コンポーネント (COM-001)
 * リポジトリ1件をカード/行として表示する。
 * 使用箇所: scr-001, scr-003, scr-004, scr-010
 */

import MetricsBadge from './MetricsBadge';
import FavoriteButton from './FavoriteButton';
import { useFavorites } from '../hooks/useFavorites';

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
  showFavoriteButton?: boolean;
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
  showFavoriteButton = false,
}: RepositoryListItemProps) {
  const { isFavorite, toggleFavorite } = useFavorites();

  return (
    <div className="repo-list-item">
      <div className="repo-list-item__header">
        <a href={`/repo/${repo.id}`} className="repo-list-item__name">
          {repo.full_name}
        </a>
        {repo.language && <span className="language-badge">{repo.language}</span>}
        {showFavoriteButton && (
          <FavoriteButton
            repo={{ id: repo.id, full_name: repo.full_name }}
            isFavorite={isFavorite(repo.id)}
            onToggle={toggleFavorite}
            size="small"
          />
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
