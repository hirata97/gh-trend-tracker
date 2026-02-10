/**
 * SortSelector Component
 * Provides a dropdown to select sort criteria for the trends list
 */
import type { SortBy } from '@gh-trend-tracker/shared';

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: '7d_increase', label: '7日間増加数' },
  { value: '30d_increase', label: '30日間増加数' },
  { value: '7d_rate', label: '7日間増加率' },
  { value: '30d_rate', label: '30日間増加率' },
  { value: 'total_stars', label: '総スター数' },
];

interface SortSelectorProps {
  currentSort: SortBy;
  onSortChange: (sort: SortBy) => void;
}

export default function SortSelector({ currentSort, onSortChange }: SortSelectorProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSortChange(e.target.value as SortBy);
  };

  return (
    <div className="filter-item">
      <select value={currentSort} onChange={handleChange} className="filter-select">
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export { SORT_OPTIONS };
