/**
 * WeekSelector Component (COM-007)
 * 週選択ナビゲーションUI
 * 矢印ナビゲーション形式で週を選択できるコンポーネント
 */

import { formatWeekRange } from '../utils/weekUtils';
import type { AvailableWeek } from '@gh-trend-tracker/shared';

interface WeekSelectorProps {
  /** 現在選択されている年 */
  currentYear: number;
  /** 現在選択されている週番号 */
  currentWeek: number;
  /** 選択可能な週のリスト（年・週の降順） */
  availableWeeks: AvailableWeek[];
  /** 週が変更されたときのコールバック */
  onWeekChange: (year: number, week: number) => void;
}

export default function WeekSelector({
  currentYear,
  currentWeek,
  availableWeeks,
  onWeekChange,
}: WeekSelectorProps) {
  // 現在の週のインデックスを取得
  const currentIndex = availableWeeks.findIndex(
    (w) => w.year === currentYear && w.week === currentWeek
  );

  // 前週に移動可能かチェック（より新しい週）
  const canGoPrevious = currentIndex > 0;
  // 次週に移動可能かチェック（より古い週）
  const canGoNext = currentIndex < availableWeeks.length - 1;

  const handlePrevious = () => {
    if (canGoPrevious) {
      const prev = availableWeeks[currentIndex - 1];
      onWeekChange(prev.year, prev.week);
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      const next = availableWeeks[currentIndex + 1];
      onWeekChange(next.year, next.week);
    }
  };

  // 日付範囲を計算
  const dateRange = formatWeekRange(currentYear, currentWeek);

  return (
    <div className="week-selector">
      <button
        className="week-selector__button week-selector__button--prev"
        onClick={handlePrevious}
        disabled={!canGoPrevious}
        aria-label="前の週"
      >
        ← 前週
      </button>
      <div className="week-selector__display">
        <span className="week-selector__year-week">
          {currentYear}年 第{currentWeek}週
        </span>
        <span className="week-selector__date-range">({dateRange})</span>
      </div>
      <button
        className="week-selector__button week-selector__button--next"
        onClick={handleNext}
        disabled={!canGoNext}
        aria-label="次の週"
      >
        次週 →
      </button>
    </div>
  );
}
