/**
 * FilterBar Component
 * Provides search, filter, and sort controls for the trends list
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { navigate } from 'astro:transitions/client';
import type { TrendSortField, SortOrder } from '@gh-trend-tracker/shared';

interface Props {
  languages: (string | null)[];
}

const SORT_OPTIONS: { value: TrendSortField; label: string }[] = [
  { value: 'stars', label: 'Stars' },
  { value: 'growth_rate', label: 'Growth Rate (%)' },
  { value: 'weekly_growth', label: 'Weekly Growth' },
];

// Parse URL parameters
function getParamsFromUrl(): {
  language: string | undefined;
  q: string;
  minStars: number | undefined;
  maxStars: number | undefined;
  sort: TrendSortField;
  order: SortOrder;
} {
  if (typeof window === 'undefined') {
    return {
      language: undefined,
      q: '',
      minStars: undefined,
      maxStars: undefined,
      sort: 'stars',
      order: 'desc',
    };
  }
  const params = new URLSearchParams(window.location.search);
  const sortParam = params.get('sort');
  const orderParam = params.get('order');
  const minStarsParam = params.get('minStars');
  const maxStarsParam = params.get('maxStars');

  return {
    language: params.get('language') || undefined,
    q: params.get('q') || '',
    minStars: minStarsParam ? parseInt(minStarsParam, 10) : undefined,
    maxStars: maxStarsParam ? parseInt(maxStarsParam, 10) : undefined,
    sort: (sortParam && ['stars', 'growth_rate', 'weekly_growth'].includes(sortParam)
      ? sortParam
      : 'stars') as TrendSortField,
    order: (orderParam && ['asc', 'desc'].includes(orderParam) ? orderParam : 'desc') as SortOrder,
  };
}

export default function FilterBar({ languages }: Props) {
  const initialParams = getParamsFromUrl();
  const [searchValue, setSearchValue] = useState(initialParams.q);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [language, setLanguage] = useState(initialParams.language);
  const [sort, setSort] = useState(initialParams.sort);
  const [order, setOrder] = useState(initialParams.order);
  const [minStars, setMinStars] = useState(initialParams.minStars);
  const [maxStars, setMaxStars] = useState(initialParams.maxStars);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync state with URL on page transitions
  useEffect(() => {
    const syncFromUrl = () => {
      const params = getParamsFromUrl();
      setSearchValue(params.q);
      setLanguage(params.language);
      setSort(params.sort);
      setOrder(params.order);
      setMinStars(params.minStars);
      setMaxStars(params.maxStars);
    };

    // Listen for Astro page transitions
    document.addEventListener('astro:page-load', syncFromUrl);
    // Also listen for popstate (browser back/forward)
    window.addEventListener('popstate', syncFromUrl);

    return () => {
      document.removeEventListener('astro:page-load', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, []);

  // Filter out null languages and sort
  const validLanguages = languages.filter((lang): lang is string => lang !== null).sort();

  // Build URL with current filters
  const buildUrl = useCallback(
    (
      overrides: Partial<{
        language: string | null;
        q: string;
        minStars: number | null;
        maxStars: number | null;
        sort: TrendSortField;
        order: SortOrder;
      }> = {}
    ) => {
      const params = new URLSearchParams();

      const lang = overrides.language !== undefined ? overrides.language : language;
      const q = overrides.q !== undefined ? overrides.q : searchValue;
      const min = overrides.minStars !== undefined ? overrides.minStars : minStars;
      const max = overrides.maxStars !== undefined ? overrides.maxStars : maxStars;
      const sortVal = overrides.sort !== undefined ? overrides.sort : sort;
      const orderVal = overrides.order !== undefined ? overrides.order : order;

      if (lang) params.set('language', lang);
      if (q) params.set('q', q);
      if (min !== undefined && min !== null) params.set('minStars', String(min));
      if (max !== undefined && max !== null) params.set('maxStars', String(max));
      if (sortVal && sortVal !== 'stars') params.set('sort', sortVal);
      if (orderVal && orderVal !== 'desc') params.set('order', orderVal);

      const queryString = params.toString();
      return queryString ? `/?${queryString}` : '/';
    },
    [language, searchValue, minStars, maxStars, sort, order]
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
      setTimeout(dispatchFilterChange, 100);
    }, 300);
  };

  // Dispatch custom event to notify TrendList
  const dispatchFilterChange = () => {
    window.dispatchEvent(new CustomEvent('filter-change'));
  };

  // Handle language change
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const language = e.target.value || null;
    navigate(buildUrl({ language }));
    setTimeout(dispatchFilterChange, 100);
  };

  // Handle sort change
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sort = e.target.value as TrendSortField;
    navigate(buildUrl({ sort }));
    setTimeout(dispatchFilterChange, 100);
  };

  // Handle order toggle
  const handleOrderToggle = () => {
    const newOrder = order === 'desc' ? 'asc' : 'desc';
    navigate(buildUrl({ order: newOrder }));
    setTimeout(dispatchFilterChange, 100);
  };

  // Handle min stars change
  const handleMinStarsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseInt(e.target.value, 10) : null;
    navigate(buildUrl({ minStars: value }));
    setTimeout(dispatchFilterChange, 100);
  };

  // Handle max stars change
  const handleMaxStarsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseInt(e.target.value, 10) : null;
    navigate(buildUrl({ maxStars: value }));
    setTimeout(dispatchFilterChange, 100);
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchValue('');
    setLanguage(undefined);
    setSort('stars');
    setOrder('desc');
    setMinStars(undefined);
    setMaxStars(undefined);
    navigate('/');
    setTimeout(dispatchFilterChange, 100);
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
  const hasActiveFilters =
    language ||
    searchValue ||
    minStars !== undefined ||
    maxStars !== undefined ||
    sort !== 'stars' ||
    order !== 'desc';

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
          <select value={language || ''} onChange={handleLanguageChange} className="filter-select">
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
          <select value={sort} onChange={handleSortChange} className="filter-select">
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
          title={order === 'desc' ? 'Descending' : 'Ascending'}
        >
          {order === 'desc' ? '↓' : '↑'}
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
