/**
 * TrendList Component
 * Displays a table of trending GitHub repositories
 */

import { useState } from 'react';
import type { TrendItem } from '@gh-trend-tracker/shared';

interface Props {
  initialTrends: TrendItem[];
}

export default function TrendList({ initialTrends }: Props) {
  const [trends] = useState(initialTrends);

  if (!trends || trends.length === 0) {
    return (
      <div className="loading">
        <p>No trending repositories found. Try running the data collection script:</p>
        <code>cd backend && npm run collect</code>
      </div>
    );
  }

  return (
    <div className="trend-list">
      <table>
        <thead>
          <tr>
            <th>Repository</th>
            <th>Language</th>
            <th>Stars</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {trends.map((trend) => (
            <tr key={trend.repoId}>
              <td>
                <a href={trend.htmlUrl} target="_blank" rel="noopener noreferrer">
                  {trend.fullName}
                </a>
              </td>
              <td>
                {trend.language ? (
                  <span className="language-badge">{trend.language}</span>
                ) : (
                  <span style={{ color: '#999' }}>N/A</span>
                )}
              </td>
              <td className="star-count">⭐ {trend.currentStars?.toLocaleString() || 0}</td>
              <td style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {trend.description || <em style={{ color: '#999' }}>No description</em>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
