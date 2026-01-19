/**
 * TrendList Component
 * Displays a table of trending GitHub repositories with expandable star history charts
 */

import React, { useState, useCallback } from 'react';
import type { TrendItem, RepoSnapshot } from '@gh-trend-tracker/shared';
import StarChart from './StarChart';
import { getRepoHistory } from '../lib/api';

interface Props {
  initialTrends: TrendItem[];
}

interface ExpandedState {
  repoId: number;
  loading: boolean;
  error: string | null;
  data: { date: string; stars: number }[];
}

export default function TrendList({ initialTrends }: Props) {
  const [trends] = useState(initialTrends);
  const [expandedRepo, setExpandedRepo] = useState<ExpandedState | null>(null);

  const handleRowClick = useCallback(async (repoId: number) => {
    // If clicking the same repo, collapse it
    if (expandedRepo?.repoId === repoId) {
      setExpandedRepo(null);
      return;
    }

    // Start loading
    setExpandedRepo({ repoId, loading: true, error: null, data: [] });

    try {
      const response = await getRepoHistory(repoId);
      const chartData = response.history.map((snapshot: RepoSnapshot) => ({
        date: snapshot.snapshotDate,
        stars: snapshot.stars,
      }));
      // Sort by date ascending
      chartData.sort((a, b) => a.date.localeCompare(b.date));
      setExpandedRepo({ repoId, loading: false, error: null, data: chartData });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setExpandedRepo({ repoId, loading: false, error: errorMessage, data: [] });
    }
  }, [expandedRepo?.repoId]);

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
            <React.Fragment key={trend.repoId}>
              <tr
                onClick={() => handleRowClick(trend.repoId)}
                className={`trend-row ${expandedRepo?.repoId === trend.repoId ? 'expanded' : ''}`}
              >
                <td>
                  <a
                    href={trend.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
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
              {expandedRepo?.repoId === trend.repoId && (
                <tr className="chart-row">
                  <td colSpan={4}>
                    <div className="chart-container">
                      <h4>Star History (Last 90 Days)</h4>
                      <StarChart
                        data={expandedRepo.data}
                        loading={expandedRepo.loading}
                        error={expandedRepo.error}
                      />
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
