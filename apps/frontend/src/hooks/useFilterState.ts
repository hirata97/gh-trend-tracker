import { useState, useEffect, useCallback, useRef } from 'react';
import { navigate } from 'astro:transitions/client';
import type { SortBy } from '@gh-trend-tracker/shared';
import { parseFilterParams, buildFilterUrl, type FilterParams } from './useFilterParams';

export interface FilterState extends FilterParams {
  showAdvanced: boolean;
  hasActiveFilters: boolean;
}

export interface FilterHandlers {
  handleSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleLanguageChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleSortByChange: (newSortBy: SortBy) => void;
  handleMinStarsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleMaxStarsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleClearFilters: () => void;
  setShowAdvanced: (value: boolean) => void;
}

function dispatchFilterChange() {
  window.dispatchEvent(new CustomEvent('filter-change'));
}

export function useFilterState(): FilterState & FilterHandlers {
  const initialParams = parseFilterParams();
  const [searchValue, setSearchValue] = useState(initialParams.q);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [language, setLanguage] = useState(initialParams.language);
  const [sortBy, setSortBy] = useState(initialParams.sortBy);
  const [minStars, setMinStars] = useState(initialParams.minStars);
  const [maxStars, setMaxStars] = useState(initialParams.maxStars);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // URLとの同期（Astroページ遷移・ブラウザ履歴操作）
  useEffect(() => {
    const syncFromUrl = () => {
      const params = parseFilterParams();
      setSearchValue(params.q);
      setLanguage(params.language);
      setSortBy(params.sortBy);
      setMinStars(params.minStars);
      setMaxStars(params.maxStars);
    };

    document.addEventListener('astro:page-load', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      document.removeEventListener('astro:page-load', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, []);

  // アンマウント時にデバウンスタイマーをクリア
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const currentParams = useCallback(
    (): FilterParams => ({ language, q: searchValue, minStars, maxStars, sortBy }),
    [language, searchValue, minStars, maxStars, sortBy]
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      navigate(buildFilterUrl(currentParams(), { q: value }));
      setTimeout(dispatchFilterChange, 100);
    }, 300);
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value || null;
    navigate(buildFilterUrl(currentParams(), { language: lang }));
    setTimeout(dispatchFilterChange, 100);
  };

  const handleSortByChange = (newSortBy: SortBy) => {
    setSortBy(newSortBy);
    navigate(buildFilterUrl(currentParams(), { sortBy: newSortBy }));
    setTimeout(dispatchFilterChange, 100);
  };

  const handleMinStarsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseInt(e.target.value, 10) : null;
    navigate(buildFilterUrl(currentParams(), { minStars: value }));
    setTimeout(dispatchFilterChange, 100);
  };

  const handleMaxStarsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseInt(e.target.value, 10) : null;
    navigate(buildFilterUrl(currentParams(), { maxStars: value }));
    setTimeout(dispatchFilterChange, 100);
  };

  const handleClearFilters = () => {
    setSearchValue('');
    setLanguage(undefined);
    setSortBy('7d_increase');
    setMinStars(undefined);
    setMaxStars(undefined);
    navigate('/');
    setTimeout(dispatchFilterChange, 100);
  };

  const hasActiveFilters = Boolean(
    language || searchValue || minStars !== undefined || maxStars !== undefined || sortBy !== '7d_increase'
  );

  return {
    q: searchValue,
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
  };
}
