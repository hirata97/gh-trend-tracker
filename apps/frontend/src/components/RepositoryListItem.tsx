/**
 * RepositoryListItem Component (COM-001)
 * Displays a single repository as a card/row in list views.
 * Used in: scr-001, scr-003, scr-004, scr-010
 */

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
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return num.toLocaleString();
}

function formatGrowth(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toLocaleString()}`;
}

export default function RepositoryListItem({
  repo,
  metrics,
  showMetrics = false,
}: RepositoryListItemProps) {
  return (
    <div className="repo-list-item">
      <div className="repo-list-item__header">
        <a href={`/repo/${repo.id}`} className="repo-list-item__name">
          {repo.full_name}
        </a>
        {repo.language && <span className="language-badge">{repo.language}</span>}
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
          <>
            <span
              className={`repo-list-item__metric ${metrics.stars_7d_increase > 0 ? 'repo-list-item__metric--positive' : ''}`}
              title="7-day star increase"
            >
              7d: {formatGrowth(metrics.stars_7d_increase)}
            </span>
            <span
              className={`repo-list-item__metric ${metrics.stars_30d_increase > 0 ? 'repo-list-item__metric--positive' : ''}`}
              title="30-day star increase"
            >
              30d: {formatGrowth(metrics.stars_30d_increase)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
