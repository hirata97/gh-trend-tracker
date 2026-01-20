/**
 * FilterBar Component
 * Provides search, filter, and sort controls for the trends list
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { navigate } from 'astro:transitions/client';
import type { TrendSortField, SortOrder } from '@gh-trend-tracker/shared';

interface Props {
  languages: (string | null)[];
  currentLanguage?: string;
  currentSearch?: string;
  currentMinStars?: number;
  currentMaxStars?: number;
  currentSort?: TrendSortField;
  currentOrder?: SortOrder;
}

const SORT_OPTIONS: { value: TrendSortField; label: string }[] = [
  { value: 'stars', label: 'Stars' },
  { value: 'growth_rate', label: 'Growth Rate (%)' },
  { value: 'weekly_growth', label: 'Weekly Growth' },
];

export default function FilterBar({
  languages,
  currentLanguage,
  currentSearch = '',
  currentMinStars,
  currentMaxStars,
  currentSort = 'stars',
  currentOrder = 'desc',
}: Props) {
  const [searchValue, setSearchValue] = useState(currentSearch);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter out null languages and sort
  const validLanguages = languages.filter((lang): lang is string => lang !== null).sort();

  // Build URL with current filters
  const buildUrl = useCallback(
    (overrides: Partial<{
      language: string | null;
      q: string;
      minStars: number | null;
      maxStars: number | null;
      sort: TrendSortField;
      order: SortOrder;
    }> = {}) => {
      const params = new URLSearchParams();

      const language = overrides.language !== undefined ? overrides.language : currentLanguage;
      const q = overrides.q !== undefined ? overrides.q : searchValue;
      const minStars = overrides.minStars !== undefined ? overrides.minStars : currentMinStars;
      const maxStars = overrides.maxStars !== undefined ? overrides.maxStars : currentMaxStars;
      const sort = overrides.sort !== undefined ? overrides.sort : currentSort;
      const order = overrides.order !== undefined ? overrides.order : currentOrder;

      if (language) params.set('language', language);
      if (q) params.set('q', q);
      if (minStars !== undefined && minStars !== null) params.set('minStars', String(minStars));
      if (maxStars !== undefined && maxStars !== null) params.set('maxStars', String(maxStars));
      if (sort && sort !== 'stars') params.set('sort', sort);
      if (order && order !== 'desc') params.set('order', order);

      const queryString = params.toString();
      return queryString ? `/?${queryString}` : '/';
    },
    [currentLanguage, searchValue, currentMinStars, currentMaxStars, currentSort, currentOrder]
  );

  // Handle search input with debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new debounce timer (300ms)
    debounceTimerRef.current = setTimeout(() => {
      navigate(buildUrl({ q: value }));
    }, 300);
  };

  // Handle language change
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const language = e.target.value || null;
    navigate(buildUrl({ language }));
  };

  // Handle sort change
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sort = e.target.value as TrendSortField;
    navigate(buildUrl({ sort }));
  };

  // Handle order toggle
  const handleOrderToggle = () => {
    const newOrder = currentOrder === 'desc' ? 'asc' : 'desc';
    navigate(buildUrl({ order: newOrder }));
  };

  // Handle min stars change
  const handleMinStarsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseInt(e.target.value, 10) : null;
    navigate(buildUrl({ minStars: value }));
  };

  // Handle max stars change
  const handleMaxStarsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseInt(e.target.value, 10) : null;
    navigate(buildUrl({ maxStars: value }));
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchValue('');
    navigate('/');
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Check if any filters are active
  const hasActiveFilters = currentLanguage || currentSearch || currentMinStars !== undefined || currentMaxStars !== undefined || currentSort !== 'stars' || currentOrder !== 'desc';

  return (
    <div className="filter-bar">
      <div className="filter-row">
        {/* Search input */}
        <div className="filter-item search-item">
          <input
            type="text"
            placeholder="Search repositories..."
            value={searchValue}
            onChange={handleSearchChange}
            className="search-input"
          />
        </div>

        {/* Language filter */}
        <div className="filter-item">
          <select
            value={currentLanguage || ''}
            onChange={handleLanguageChange}
            className="filter-select"
          >
            <option value="">All Languages</option>
            {validLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>

        {/* Sort selector */}
        <div className="filter-item">
          <select
            value={currentSort}
            onChange={handleSortChange}
            className="filter-select"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sort order toggle */}
        <button
          className="order-toggle"
          onClick={handleOrderToggle}
          title={currentOrder === 'desc' ? 'Descending' : 'Ascending'}
        >
          {currentOrder === 'desc' ? '↓' : '↑'}
        </button>

        {/* Advanced filters toggle */}
        <button
          className={`advanced-toggle ${showAdvanced ? 'active' : ''}`}
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          Filters {showAdvanced ? '▲' : '▼'}
        </button>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button className="clear-filters" onClick={handleClearFilters}>
            Clear
          </button>
        )}
      </div>

      {/* Advanced filters panel */}
      {showAdvanced && (
        <div className="advanced-filters">
          <div className="filter-item">
            <label htmlFor="minStars">Min Stars:</label>
            <input
              id="minStars"
              type="number"
              min="0"
              placeholder="0"
              value={currentMinStars ?? ''}
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
              value={currentMaxStars ?? ''}
              onChange={handleMaxStarsChange}
              className="stars-input"
            />
          </div>
        </div>
      )}
    </div>
  );
}
