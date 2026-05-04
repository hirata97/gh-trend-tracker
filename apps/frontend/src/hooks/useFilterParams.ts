import type { SortBy } from '@gh-trend-tracker/shared';

export interface FilterParams {
  language: string | undefined;
  q: string;
  minStars: number | undefined;
  maxStars: number | undefined;
  sortBy: SortBy;
}

const VALID_SORT_VALUES: SortBy[] = ['7d_increase', '30d_increase', '7d_rate', '30d_rate', 'total_stars'];
const DEFAULT_SORT: SortBy = '7d_increase';

export function parseFilterParams(): FilterParams {
  if (typeof window === 'undefined') {
    return { language: undefined, q: '', minStars: undefined, maxStars: undefined, sortBy: DEFAULT_SORT };
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
      : DEFAULT_SORT) as SortBy,
  };
}

export function buildFilterUrl(
  current: FilterParams,
  overrides: Partial<{
    language: string | null;
    q: string;
    minStars: number | null;
    maxStars: number | null;
    sortBy: SortBy;
  }> = {}
): string {
  const params = new URLSearchParams();

  const lang = overrides.language !== undefined ? overrides.language : current.language;
  const q = overrides.q !== undefined ? overrides.q : current.q;
  const min = overrides.minStars !== undefined ? overrides.minStars : current.minStars;
  const max = overrides.maxStars !== undefined ? overrides.maxStars : current.maxStars;
  const sortByVal = overrides.sortBy !== undefined ? overrides.sortBy : current.sortBy;

  if (lang) params.set('language', lang);
  if (q) params.set('q', q);
  if (min !== undefined && min !== null) params.set('minStars', String(min));
  if (max !== undefined && max !== null) params.set('maxStars', String(max));
  if (sortByVal && sortByVal !== DEFAULT_SORT) params.set('sort_by', sortByVal);

  const queryString = params.toString();
  return queryString ? `/?${queryString}` : '/';
}
