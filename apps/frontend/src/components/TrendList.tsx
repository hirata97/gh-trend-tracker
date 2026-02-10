/**
 * TrendList Component
 * Displays a table of trending GitHub repositories with expandable star history charts
 */

import React, { useState, useCallback, useEffect } from 'react';
import type { TrendsDailyItem, RepoSnapshot, SortBy } from '@gh-trend-tracker/shared';
import StarChart from './StarChart';
import { getRepoHistory, getTrendsDaily } from '../lib/api';

interface Props {
  initialTrends: TrendsDailyItem[];
}

interface ExpandedState {
  repoId: number;
  loading: boolean;
  error: string | null;
  data: { date: string; stars: number }[];
}

const VALID_SORT_VALUES: SortBy[] = ['7d_increase', '30d_increase', '7d_rate', '30d_rate', 'total_stars'];

// Parse filter params from URL
function getFilterParamsFromUrl(): { language?: string; sort_by: SortBy } {
  if (typeof window === 'undefined') return { sort_by: '7d_increase' };
  const params = new URLSearchParams(window.location.search);
  const sortByParam = params.get('sort_by');

  return {
    language: params.get('language') || undefined,
    sort_by: (sortByParam && VALID_SORT_VALUES.includes(sortByParam as SortBy)
      ? sortByParam
      : '7d_increase') as SortBy,
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
        const response = await getTrendsDaily(params);
        setTrends(response.data || []);
      } catch {
        // Error handling - keep current trends on failure
      } finally {
        setLoading(false);
      }
    };

    // Listen for Astro page transitions
    document.addEventListener('astro:page-load', fetchTrends);
    // Listen for popstate (browser back/forward)
    window.addEventListener('popstate', fetchTrends);
    // Listen for custom filter change event
    window.addEventListener('filter-change', fetchTrends);

    return () => {
      document.removeEventListener('astro:page-load', fetchTrends);
      window.removeEventListener('popstate', fetchTrends);
      window.removeEventListener('filter-change', fetchTrends);
    };
  }, []);

  // Also fetch on initial mount if URL has params (for static site)
  useEffect(() => {
    const params = getFilterParamsFromUrl();
    // If URL has any filter params, fetch fresh data
    if (params.language || params.sort_by !== '7d_increase') {
      const fetchInitial = async () => {
        setLoading(true);
        try {
          const response = await getTrendsDaily(params);
          setTrends(response.data || []);
        } catch {
          // Keep initial trends on failure
        } finally {
          setLoading(false);
        }
      };
      fetchInitial();
    }
  }, []); // Run once on mount

  const handleRowClick = useCallback(
    async (repoId: number) => {
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
    },
    [expandedRepo?.repoId]
  );

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

  const formatRate = (rate: number): string => {
    const sign = rate >= 0 ? '+' : '';
    return `${sign}${rate.toFixed(2)}%`;
  };

  const formatIncrease = (count: number): string => {
    const sign = count >= 0 ? '+' : '';
    return `${sign}${count.toLocaleString()}`;
  };

  const getGrowthClass = (rate: number): string => {
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
            <th>7d Growth</th>
            <th>30d Growth</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {trends.map((trend) => {
            const repoId = Number(trend.id);
            return (
              <React.Fragment key={trend.id}>
                <tr
                  onClick={() => handleRowClick(repoId)}
                  className={`trend-row ${expandedRepo?.repoId === repoId ? 'expanded' : ''}`}
                >
                  <td>
                    <a href={`/repo/${trend.id}`} onClick={(e) => e.stopPropagation()}>
                      {trend.full_name}
                    </a>
                  </td>
                  <td>
                    {trend.language ? (
                      <span className="language-badge">{trend.language}</span>
                    ) : (
                      <span style={{ color: '#999' }}>N/A</span>
                    )}
                  </td>
                  <td className="star-count">{trend.stargazers_count.toLocaleString()}</td>
                  <td className={`weekly-growth ${getGrowthClass(trend.stars_7d_rate)}`}>
                    <span className="growth-value">{formatIncrease(trend.stars_7d_increase)}</span>
                    <span className="growth-rate">({formatRate(trend.stars_7d_rate)})</span>
                  </td>
                  <td className={`weekly-growth ${getGrowthClass(trend.stars_30d_rate)}`}>
                    <span className="growth-value">{formatIncrease(trend.stars_30d_increase)}</span>
                    <span className="growth-rate">({formatRate(trend.stars_30d_rate)})</span>
                  </td>
                  <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {trend.description || <em style={{ color: '#999' }}>No description</em>}
                  </td>
                </tr>
                {expandedRepo?.repoId === repoId && (
                  <tr className="chart-row">
                    <td colSpan={6}>
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
