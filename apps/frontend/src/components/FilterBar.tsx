/**
 * FilterBar Component
 * Provides search, filter, and sort controls for the trends list
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { navigate } from 'astro:transitions/client';
import type { SortBy } from '@gh-trend-tracker/shared';
import SortSelector from './SortSelector';

interface Props {
  languages: (string | null)[];
}

const VALID_SORT_VALUES: SortBy[] = ['7d_increase', '30d_increase', '7d_rate', '30d_rate', 'total_stars'];

// Parse URL parameters
function getParamsFromUrl(): {
  language: string | undefined;
  q: string;
  minStars: number | undefined;
  maxStars: number | undefined;
  sortBy: SortBy;
} {
  if (typeof window === 'undefined') {
    return {
      language: undefined,
      q: '',
      minStars: undefined,
      maxStars: undefined,
      sortBy: '7d_increase',
    };
  }
  const params = new URLSearchParams(window.location.search);
  const sortByParam = params.get('sort_by');
  const minStarsParam = params.get('minStars');
  const maxStarsParam = params.get('maxStars');

  return {
    language: params.get('language') || undefined,
    q: params.get('q') || '',
    minStars: minStarsParam ? parseInt(minStarsParam, 10) : undefined,
    maxStars: maxStarsParam ? parseInt(maxStarsParam, 10) : undefined,
    sortBy: (sortByParam && VALID_SORT_VALUES.includes(sortByParam as SortBy)
      ? sortByParam
      : '7d_increase') as SortBy,
  };
}

export default function FilterBar({ languages }: Props) {
  const initialParams = getParamsFromUrl();
  const [searchValue, setSearchValue] = useState(initialParams.q);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [language, setLanguage] = useState(initialParams.language);
  const [sortBy, setSortBy] = useState(initialParams.sortBy);
  const [minStars, setMinStars] = useState(initialParams.minStars);
  const [maxStars, setMaxStars] = useState(initialParams.maxStars);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync state with URL on page transitions
  useEffect(() => {
    const syncFromUrl = () => {
      const params = getParamsFromUrl();
      setSearchValue(params.q);
      setLanguage(params.language);
      setSortBy(params.sortBy);
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
        sortBy: SortBy;
      }> = {}
    ) => {
      const params = new URLSearchParams();

      const lang = overrides.language !== undefined ? overrides.language : language;
      const q = overrides.q !== undefined ? overrides.q : searchValue;
      const min = overrides.minStars !== undefined ? overrides.minStars : minStars;
      const max = overrides.maxStars !== undefined ? overrides.maxStars : maxStars;
      const sortByVal = overrides.sortBy !== undefined ? overrides.sortBy : sortBy;

      if (lang) params.set('language', lang);
      if (q) params.set('q', q);
      if (min !== undefined && min !== null) params.set('minStars', String(min));
      if (max !== undefined && max !== null) params.set('maxStars', String(max));
      if (sortByVal && sortByVal !== '7d_increase') params.set('sort_by', sortByVal);

      const queryString = params.toString();
      return queryString ? `/?${queryString}` : '/';
    },
    [language, searchValue, minStars, maxStars, sortBy]
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

  // Handle sort_by change
  const handleSortByChange = (newSortBy: SortBy) => {
    setSortBy(newSortBy);
    navigate(buildUrl({ sortBy: newSortBy }));
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
    setSortBy('7d_increase');
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
    sortBy !== '7d_increase';

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
        <SortSelector currentSort={sortBy} onSortChange={handleSortByChange} />

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
