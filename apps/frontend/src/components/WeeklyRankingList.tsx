/**
 * WeeklyRankingList Component (COM-008)
 * 週別トレンドランキングをリスト形式で表示
 */

import type { WeeklyTrendItem } from '@gh-trend-tracker/shared';

interface WeeklyRankingListProps {
  /** ランキングデータ */
  ranking: WeeklyTrendItem[];
  /** メタデータ */
  metadata: {
    year: number;
    week: number;
    language: string;
  };
}

export default function WeeklyRankingList({ ranking, metadata }: WeeklyRankingListProps) {
  if (!ranking || ranking.length === 0) {
    return (
      <div className="weekly-ranking-empty">
        <p className="weekly-ranking-empty__message">
          {metadata.year}年 第{metadata.week}週
          {metadata.language && metadata.language !== 'all' && ` (${metadata.language})`}
          のランキングデータがありません
        </p>
        <p className="weekly-ranking-empty__hint">
          週別集計が実行されると、ここにランキングが表示されます
        </p>
      </div>
    );
  }

  return (
    <div className="weekly-ranking-list">
      <div className="weekly-ranking-list__header">
        <h2>
          {metadata.year}年 第{metadata.week}週のトレンド
          {metadata.language && metadata.language !== 'all' && ` (${metadata.language})`}
        </h2>
        <p className="weekly-ranking-list__count">
          {ranking.length}件のリポジトリ
        </p>
      </div>

      <div className="weekly-ranking-list__items">
        {ranking.map((item) => (
          <div key={`${item.rank}-${item.repo_id}`} className="weekly-ranking-item">
            <div className="weekly-ranking-item__rank">
              <span className="weekly-ranking-item__rank-number">#{item.rank}</span>
            </div>
            <div className="weekly-ranking-item__content">
              <div className="weekly-ranking-item__header">
                <a
                  href={`/repo/${item.repo_id}`}
                  className="weekly-ranking-item__name"
                >
                  {item.repo_full_name}
                </a>
              </div>
              <div className="weekly-ranking-item__stats">
                <span className="weekly-ranking-item__star-increase">
                  ⭐ +{item.star_increase.toLocaleString()} stars (7日間)
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
