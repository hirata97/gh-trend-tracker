import { describe, it, expect } from 'vitest';
import { SearchQuerySchema } from './search';

describe('SearchQuerySchema', () => {
  it('有効なクエリパラメータをパースする', () => {
    const result = SearchQuerySchema.safeParse({
      query: 'react',
      limit: '10',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query).toBe('react');
      expect(result.data.limit).toBe(10);
    }
  });

  it('デフォルト値を適用する', () => {
    const result = SearchQuerySchema.safeParse({
      query: 'vue',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });

  it('query が2文字未満の場合、バリデーションエラーを返す', () => {
    const result = SearchQuerySchema.safeParse({
      query: 'a',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('at least 2 characters');
    }
  });

  it('query が100文字を超える場合、バリデーションエラーを返す', () => {
    const result = SearchQuerySchema.safeParse({
      query: 'a'.repeat(101), // 101文字
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('at most 100 characters');
    }
  });

  it('limit が100を超える場合、バリデーションエラーを返す', () => {
    const result = SearchQuerySchema.safeParse({
      query: 'angular',
      limit: '101',
    });

    expect(result.success).toBe(false);
  });

  it('limit が1未満の場合、バリデーションエラーを返す', () => {
    const result = SearchQuerySchema.safeParse({
      query: 'svelte',
      limit: '0',
    });

    expect(result.success).toBe(false);
  });
});
