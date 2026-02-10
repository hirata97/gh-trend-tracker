/**
 * TrendList コンポーネント
 * トレンドGitHubリポジトリをテーブル形式で表示し、展開可能なスター推移チャートを含む
 */

import React, { useState, useCallback, useEffect } from 'react';
import { navigate } from 'astro:transitions/client';
import type { TrendsDailyItem, RepoSnapshot, SortBy } from '@gh-trend-tracker/shared';
import StarChart from './StarChart';
import MetricsBadge from './MetricsBadge';
import Pagination from './Pagination';
import { getRepoHistory, getTrendsDaily } from '../lib/api';

interface Props {
  initialTrends: TrendsDailyItem[];
  initialPagination: { page: number; totalPages: number };
}

interface ExpandedState {
  repoId: number;
  loading: boolean;
  error: string | null;
  data: { date: string; stars: number }[];
}

const VALID_SORT_VALUES: SortBy[] = ['7d_increase', '30d_increase', '7d_rate', '30d_rate', 'total_stars'];

// URLからフィルタパラメータを取得
function getFilterParamsFromUrl(): { language?: string; sort_by: SortBy; page: number } {
  if (typeof window === 'undefined') return { sort_by: '7d_increase', page: 1 };
  const params = new URLSearchParams(window.location.search);
  const sortByParam = params.get('sort_by');
  const pageParam = params.get('page');
  const page = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;

  return {
    language: params.get('language') || undefined,
    sort_by: (sortByParam && VALID_SORT_VALUES.includes(sortByParam as SortBy)
      ? sortByParam
      : '7d_increase') as SortBy,
    page,
  };
}

export default function TrendList({ initialTrends, initialPagination }: Props) {
  const [trends, setTrends] = useState(initialTrends);
  const [loading, setLoading] = useState(false);
  const [expandedRepo, setExpandedRepo] = useState<ExpandedState | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPagination.page);
  const [totalPages, setTotalPages] = useState(initialPagination.totalPages);

  // URL変更時にデータを再取得
  useEffect(() => {
    const fetchTrends = async () => {
      setLoading(true);
      try {
        const params = getFilterParamsFromUrl();
        const response = await getTrendsDaily(params);
        setTrends(response.data || []);
        setCurrentPage(response.pagination.page);
        setTotalPages(response.pagination.totalPages);
      } catch {
        // エラー時は現在のトレンドを維持
      } finally {
        setLoading(false);
      }
    };

    // Astroページ遷移を監視
    document.addEventListener('astro:page-load', fetchTrends);
    // ブラウザの戻る/進むを監視
    window.addEventListener('popstate', fetchTrends);
    // フィルタ変更イベントを監視
    window.addEventListener('filter-change', fetchTrends);

    return () => {
      document.removeEventListener('astro:page-load', fetchTrends);
      window.removeEventListener('popstate', fetchTrends);
      window.removeEventListener('filter-change', fetchTrends);
    };
  }, []);

  // 初回マウント時にURLパラメータがあればデータを取得（静的サイト用）
  useEffect(() => {
    const params = getFilterParamsFromUrl();
    // フィルタパラメータがある場合、最新データを取得
    if (params.language || params.sort_by !== '7d_increase' || params.page > 1) {
      const fetchInitial = async () => {
        setLoading(true);
        try {
          const response = await getTrendsDaily(params);
          setTrends(response.data || []);
          setCurrentPage(response.pagination.page);
          setTotalPages(response.pagination.totalPages);
        } catch {
          // 失敗時は初期トレンドを維持
        } finally {
          setLoading(false);
        }
      };
      fetchInitial();
    }
  }, []); // マウント時に1回だけ実行

  // ページ変更ハンドラ
  const handlePageChange = useCallback((page: number) => {
    const params = new URLSearchParams(window.location.search);
    if (page > 1) {
      params.set('page', String(page));
    } else {
      params.delete('page');
    }
    const queryString = params.toString();
    const url = queryString ? `/?${queryString}` : '/';
    navigate(url);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('filter-change'));
    }, 100);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleRowClick = useCallback(
    async (repoId: number) => {
      // 同じリポジトリをクリックした場合は閉じる
      if (expandedRepo?.repoId === repoId) {
        setExpandedRepo(null);
        return;
      }

      // ローディング開始
      setExpandedRepo({ repoId, loading: true, error: null, data: [] });

      try {
        const response = await getRepoHistory(repoId);
        const chartData = response.history.map((snapshot: RepoSnapshot) => ({
          date: snapshot.snapshotDate,
          stars: snapshot.stars,
        }));
        // 日付昇順でソート
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

  const currentSort = getFilterParamsFromUrl().sort_by;
  const isRateSort = currentSort === '7d_rate' || currentSort === '30d_rate';
  const badgeType = isRateSort ? 'rate' : 'increase';

  return (
    <div className="trend-list">
      <table>
        <thead>
          <tr>
            <th>Repository</th>
            <th>Language</th>
            <th>Stars</th>
            <th>Growth</th>
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
                  <td>
                    <div className="metrics-badge-group">
                      <MetricsBadge
                        value={badgeType === 'rate' ? trend.stars_7d_rate : trend.stars_7d_increase}
                        period="7d"
                        type={badgeType}
                      />
                      <MetricsBadge
                        value={badgeType === 'rate' ? trend.stars_30d_rate : trend.stars_30d_increase}
                        period="30d"
                        type={badgeType}
                      />
                    </div>
                  </td>
                  <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {trend.description || <em style={{ color: '#999' }}>No description</em>}
                  </td>
                </tr>
                {expandedRepo?.repoId === repoId && (
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
            );
          })}
        </tbody>
      </table>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
