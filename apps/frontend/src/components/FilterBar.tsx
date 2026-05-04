import SortSelector from './SortSelector';
import { useFilterState } from '../hooks/useFilterState';

interface Props {
  languages: (string | null)[];
}

export default function FilterBar({ languages }: Props) {
  const {
    q,
    language,
    sortBy,
    minStars,
    maxStars,
    showAdvanced,
    hasActiveFilters,
    handleSearchChange,
    handleLanguageChange,
    handleSortByChange,
    handleMinStarsChange,
    handleMaxStarsChange,
    handleClearFilters,
    setShowAdvanced,
  } = useFilterState();

  const validLanguages = languages.filter((lang): lang is string => lang !== null).sort();

  return (
    <div className="filter-bar">
      <div className="filter-row">
        <div className="filter-item search-item">
          <input
            type="text"
            placeholder="Search repositories..."
            value={q}
            onChange={handleSearchChange}
            className="search-input"
          />
        </div>

        <div className="filter-item">
          <select value={language || ''} onChange={handleLanguageChange} className="filter-select">
            <option value="">All Languages</option>
            {validLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>

        <SortSelector currentSort={sortBy} onSortChange={handleSortByChange} />

        <button
          className={`advanced-toggle ${showAdvanced ? 'active' : ''}`}
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          Filters {showAdvanced ? '▲' : '▼'}
        </button>

        {hasActiveFilters && (
          <button className="clear-filters" onClick={handleClearFilters}>
            Clear
          </button>
        )}
      </div>

      {showAdvanced && (
        <div className="advanced-filters">
          <div className="filter-item">
            <label htmlFor="minStars">Min Stars:</label>
            <input
              id="minStars"
              type="number"
              min="0"
              placeholder="0"
              value={minStars ?? ''}
              onChange={handleMinStarsChange}
              className="stars-input"
            />
          </div>
          <div className="filter-item">
            <label htmlFor="maxStars">Max Stars:</label>
            <input
              id="maxStars"
              type="number"
              min="0"
              placeholder="∞"
              value={maxStars ?? ''}
              onChange={handleMaxStarsChange}
              className="stars-input"
            />
          </div>
        </div>
      )}
    </div>
  );
}
