/**
 * RepoDetail コンポーネントのテスト
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RepoDetail from './RepoDetail';
import type { RepoDetailResponse } from '@gh-trend-tracker/shared';

vi.mock('../hooks/useFavorites', () => ({
  useFavorites: () => ({
    isFavorite: vi.fn().mockReturnValue(false),
    toggleFavorite: vi.fn(),
    favorites: [],
    addFavorite: vi.fn(),
    removeFavorite: vi.fn(),
  }),
}));

vi.mock('./StarChart', () => ({
  default: ({ data }: { data: { date: string; stars: number }[] }) => (
    <div data-testid="star-chart">StarChart({data.length} points)</div>
  ),
}));

const baseDetail: RepoDetailResponse = {
  repository: {
    repoId: 1,
    name: 'react',
    owner: 'facebook',
    fullName: 'facebook/react',
    description: 'A JavaScript library for building user interfaces',
    language: 'JavaScript',
    htmlUrl: 'https://github.com/facebook/react',
    homepage: 'https://reactjs.org',
    topics: ['javascript', 'ui', 'library'],
  },
  currentStats: {
    stars: 225000,
    forks: 46000,
    watchers: 225000,
    openIssues: 1200,
    snapshotDate: '2026-01-08',
  },
  weeklyGrowth: 500,
  weeklyGrowthRate: 0.22,
};

const baseHistory = [
  { date: '2026-01-01', stars: 224000 },
  { date: '2026-01-08', stars: 225000 },
];

describe('RepoDetail', () => {
  describe('リポジトリ情報の表示', () => {
    it('リポジトリ名が表示される', () => {
      render(<RepoDetail detail={baseDetail} history={baseHistory} />);

      expect(screen.getByText('facebook/react')).toBeInTheDocument();
    });

    it('リポジトリ説明が表示される', () => {
      render(<RepoDetail detail={baseDetail} history={baseHistory} />);

      expect(screen.getByText('A JavaScript library for building user interfaces')).toBeInTheDocument();
    });

    it('言語バッジが表示される', () => {
      render(<RepoDetail detail={baseDetail} history={baseHistory} />);

      expect(screen.getByText('JavaScript')).toBeInTheDocument();
    });

    it('トピックが表示される', () => {
      render(<RepoDetail detail={baseDetail} history={baseHistory} />);

      expect(screen.getByText('javascript')).toBeInTheDocument();
      expect(screen.getByText('ui')).toBeInTheDocument();
      expect(screen.getByText('library')).toBeInTheDocument();
    });

    it('HomepageリンクがhtmlUrl先を指す', () => {
      render(<RepoDetail detail={baseDetail} history={baseHistory} />);

      const githubLink = screen.getByText('facebook/react').closest('a');
      expect(githubLink).toHaveAttribute('href', 'https://github.com/facebook/react');
    });
  });

  describe('統計情報の表示', () => {
    it('スター数が表示される', () => {
      render(<RepoDetail detail={baseDetail} history={baseHistory} />);

      const starsLabel = screen.getByText('Stars');
      expect(starsLabel.closest('.stat-item')?.querySelector('.stat-value')?.textContent).toBe('225,000');
    });

    it('フォーク数が表示される', () => {
      render(<RepoDetail detail={baseDetail} history={baseHistory} />);

      expect(screen.getByText('46,000')).toBeInTheDocument();
    });

    it('オープンIssue数が表示される', () => {
      render(<RepoDetail detail={baseDetail} history={baseHistory} />);

      expect(screen.getByText('1,200')).toBeInTheDocument();
    });

    it('週次成長率が表示される', () => {
      render(<RepoDetail detail={baseDetail} history={baseHistory} />);

      expect(screen.getByText('+500 (+0.22%)')).toBeInTheDocument();
    });
  });

  describe('統計なしの場合', () => {
    it('currentStatsがnullの場合、No statistics availableが表示される', () => {
      const detailNoStats: RepoDetailResponse = {
        ...baseDetail,
        currentStats: null,
        weeklyGrowth: null,
        weeklyGrowthRate: null,
      } as RepoDetailResponse;
      render(<RepoDetail detail={detailNoStats} history={baseHistory} />);

      expect(screen.getByText('No statistics available')).toBeInTheDocument();
    });
  });

  describe('StarChart', () => {
    it('StarChartコンポーネントが表示される', () => {
      render(<RepoDetail detail={baseDetail} history={baseHistory} />);

      expect(screen.getByTestId('star-chart')).toBeInTheDocument();
    });
  });

  describe('オプショナル要素', () => {
    it('homepageがない場合はHomepageリンクが表示されない', () => {
      const detailNoHomepage: RepoDetailResponse = {
        ...baseDetail,
        repository: { ...baseDetail.repository, homepage: null },
      };
      render(<RepoDetail detail={detailNoHomepage} history={baseHistory} />);

      expect(screen.queryByText('Homepage')).not.toBeInTheDocument();
    });

    it('トピックがない場合はトピック欄が表示されない', () => {
      const detailNoTopics: RepoDetailResponse = {
        ...baseDetail,
        repository: { ...baseDetail.repository, topics: [] },
      };
      const { container } = render(<RepoDetail detail={detailNoTopics} history={baseHistory} />);

      expect(container.querySelector('.topics')).not.toBeInTheDocument();
    });

    it('descriptionがない場合はdescriptionが表示されない', () => {
      const detailNoDesc: RepoDetailResponse = {
        ...baseDetail,
        repository: { ...baseDetail.repository, description: null },
      };
      render(<RepoDetail detail={detailNoDesc} history={baseHistory} />);

      expect(screen.queryByText('A JavaScript library for building user interfaces')).not.toBeInTheDocument();
    });
  });
});
