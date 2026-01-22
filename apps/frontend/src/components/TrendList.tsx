/**
 * TrendList Component
 * Displays a table of trending GitHub repositories with expandable star history charts
 */

import React, { useState, useCallback, useEffect } from 'react';
import type { TrendItem, RepoSnapshot } from '@gh-trend-tracker/shared';
import StarChart from './StarChart';
import { getRepoHistory, getTrends } from '../lib/api';

interface Props {
  initialTrends: TrendItem[];
}

interface ExpandedState {
  repoId: number;
  loading: boolean;
  error: string | null;
  data: { date: string; stars: number }[];
}

// Parse filter params from URL
function getFilterParamsFromUrl() {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const sortParam = params.get('sort');
  const orderParam = params.get('order');
  const minStarsParam = params.get('minStars');
  const maxStarsParam = params.get('maxStars');

  return {
    language: params.get('language') || undefined,
    q: params.get('q') || undefined,
    minStars: minStarsParam ? parseInt(minStarsParam, 10) : undefined,
    maxStars: maxStarsParam ? parseInt(maxStarsParam, 10) : undefined,
    sort: sortParam as 'stars' | 'growth_rate' | 'weekly_growth' | undefined,
    order: orderParam as 'asc' | 'desc' | undefined,
  };
}

export default function TrendList({ initialTrends }: Props) {
  const [trends, setTrends] = useState(initialTrends);
  const [loading, setLoading] = useState(false);
  const [expandedRepo, setExpandedRepo] = useState<ExpandedState | null>(null);

  // Fetch data when URL changes
  useEffect(() => {
    const fetchTrends = async () => {
      setLoading(true);
      try {
        const params = getFilterParamsFromUrl();
        const response = await getTrends(params);
        setTrends(response.trends || []);
      } catch (err) {
        console.error('Failed to fetch trends:', err);
      } finally {
        setLoading(false);
      }
    };

    const handlePageLoad = () => {
      fetchTrends();
    };

    // Listen for Astro page transitions
    document.addEventListener('astro:page-load', handlePageLoad);
    // Also listen for popstate (browser back/forward)
    window.addEventListener('popstate', handlePageLoad);

    return () => {
      document.removeEventListener('astro:page-load', handlePageLoad);
      window.removeEventListener('popstate', handlePageLoad);
    };
  }, []);

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

  if (loading) {
    return (
      <div className="loading">
        <p>Loading...</p>
      </div>
    );
  }

  if (!trends || trends.length === 0) {
    return (
      <div className="loading">
        <p>No trending repositories found. Try running the data collection script:</p>
        <code>cd backend && npm run collect</code>
      </div>
    );
  }

  const formatGrowthRate = (rate: number | null): string => {
    if (rate === null) return '-';
    const sign = rate >= 0 ? '+' : '';
    return `${sign}${rate.toFixed(2)}%`;
  };

  const formatGrowth = (growth: number | null): string => {
    if (growth === null) return '-';
    const sign = growth >= 0 ? '+' : '';
    return `${sign}${growth.toLocaleString()}`;
  };

  const getGrowthClass = (rate: number | null): string => {
    if (rate === null) return 'growth-neutral';
    if (rate >= 5) return 'growth-high';
    if (rate >= 1) return 'growth-medium';
    return 'growth-low';
  };

  return (
    <div className="trend-list">
      <table>
        <thead>
          <tr>
            <th>Repository</th>
            <th>Language</th>
            <th>Stars</th>
            <th>Weekly Growth</th>
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
                    href={`/repo/${trend.repoId}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {trend.fullName}
                  </a>
                  <a
                    href={trend.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="external-link"
                    title="Open on GitHub"
                  >
                    ↗
                  </a>
                </td>
                <td>
                  {trend.language ? (
                    <span className="language-badge">{trend.language}</span>
                  ) : (
                    <span style={{ color: '#999' }}>N/A</span>
                  )}
                </td>
                <td className="star-count">
                  {trend.currentStars?.toLocaleString() || 0}
                </td>
                <td className={`weekly-growth ${getGrowthClass(trend.weeklyGrowthRate)}`}>
                  <span className="growth-value">{formatGrowth(trend.weeklyGrowth)}</span>
                  <span className="growth-rate">({formatGrowthRate(trend.weeklyGrowthRate)})</span>
                </td>
                <td style={{ maxWidth: '350px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {trend.description || <em style={{ color: '#999' }}>No description</em>}
                </td>
              </tr>
              {expandedRepo?.repoId === trend.repoId && (
                <tr className="chart-row">
                  <td colSpan={5}>
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
