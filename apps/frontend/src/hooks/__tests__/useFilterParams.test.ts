import { describe, it, expect, beforeEach } from 'vitest';
import { parseFilterParams, buildFilterUrl, type FilterParams } from '../useFilterParams';

function setSearch(search: string) {
  Object.defineProperty(window, 'location', {
    value: new URL(`http://localhost${search ? `?${search.replace(/^\?/, '')}` : ''}`),
    writable: true,
    configurable: true,
  });
}

describe('parseFilterParams', () => {
  beforeEach(() => {
    setSearch('');
  });

  it('クエリパラメータが空の場合はデフォルト値を返す', () => {
    const result = parseFilterParams();
    expect(result).toEqual({
      language: undefined,
      q: '',
      minStars: undefined,
      maxStars: undefined,
      sortBy: '7d_increase',
    });
  });

  it('languageパラメータを正しく解析する', () => {
    setSearch('?language=TypeScript');
    const result = parseFilterParams();
    expect(result.language).toBe('TypeScript');
  });

  it('qパラメータを正しく解析する', () => {
    setSearch('?q=react');
    const result = parseFilterParams();
    expect(result.q).toBe('react');
  });

  it('minStars・maxStarsを数値として解析する', () => {
    setSearch('?minStars=100&maxStars=5000');
    const result = parseFilterParams();
    expect(result.minStars).toBe(100);
    expect(result.maxStars).toBe(5000);
  });

  it('有効なsort_byパラメータを解析する', () => {
    setSearch('?sort_by=30d_increase');
    const result = parseFilterParams();
    expect(result.sortBy).toBe('30d_increase');
  });

  it('無効なsort_byはデフォルト値(7d_increase)にフォールバックする', () => {
    setSearch('?sort_by=invalid_value');
    const result = parseFilterParams();
    expect(result.sortBy).toBe('7d_increase');
  });
});

describe('buildFilterUrl', () => {
  const base: FilterParams = {
    language: undefined,
    q: '',
    minStars: undefined,
    maxStars: undefined,
    sortBy: '7d_increase',
  };

  it('全てデフォルトの場合はルートURLを返す', () => {
    expect(buildFilterUrl(base)).toBe('/');
  });

  it('languageを含むURLを生成する', () => {
    expect(buildFilterUrl(base, { language: 'TypeScript' })).toBe('/?language=TypeScript');
  });

  it('検索クエリを含むURLを生成する', () => {
    expect(buildFilterUrl(base, { q: 'react' })).toBe('/?q=react');
  });

  it('minStars・maxStarsを含むURLを生成する', () => {
    expect(buildFilterUrl(base, { minStars: 100, maxStars: 5000 })).toBe(
      '/?minStars=100&maxStars=5000'
    );
  });

  it('デフォルト以外のsort_byを含むURLを生成する', () => {
    expect(buildFilterUrl(base, { sortBy: '30d_increase' })).toBe('/?sort_by=30d_increase');
  });

  it('デフォルトのsort_by(7d_increase)はURLに含まない', () => {
    const url = buildFilterUrl(base, { sortBy: '7d_increase' });
    expect(url).not.toContain('sort_by');
  });

  it('languageをnullに設定すると除去される', () => {
    const withLang: FilterParams = { ...base, language: 'TypeScript' };
    expect(buildFilterUrl(withLang, { language: null })).toBe('/');
  });

  it('複数のフィルタを組み合わせてURLを生成する', () => {
    const url = buildFilterUrl(base, { language: 'Go', q: 'web', sortBy: 'total_stars' });
    expect(url).toContain('language=Go');
    expect(url).toContain('q=web');
    expect(url).toContain('sort_by=total_stars');
  });
});
