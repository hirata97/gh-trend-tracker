import { describe, it, expect } from 'vitest';
import { TrendsDailyQuerySchema } from './trends';

describe('TrendsDailyQuerySchema', () => {
  it('有効なクエリパラメータをパースする', () => {
    const result = TrendsDailyQuerySchema.safeParse({
      language: 'TypeScript',
      sort_by: '7d_increase',
      page: '1',
      limit: '20',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.language).toBe('TypeScript');
      expect(result.data.sort_by).toBe('7d_increase');
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it('デフォルト値を適用する', () => {
    const result = TrendsDailyQuerySchema.safeParse({
      sort_by: '7d_increase',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.language).toBeUndefined();
    }
  });

  it('language が50文字を超える場合、バリデーションエラーを返す', () => {
    const result = TrendsDailyQuerySchema.safeParse({
      language: 'a'.repeat(51), // 51文字
      sort_by: '7d_increase',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('at most 50 characters');
    }
  });

  it('無効なsort_byを拒否する', () => {
    const result = TrendsDailyQuerySchema.safeParse({
      sort_by: 'invalid_sort',
    });

    expect(result.success).toBe(false);
  });

  it('page が正の整数でない場合、バリデーションエラーを返す', () => {
    const result1 = TrendsDailyQuerySchema.safeParse({
      sort_by: '7d_increase',
      page: '0',
    });

    expect(result1.success).toBe(false);

    const result2 = TrendsDailyQuerySchema.safeParse({
      sort_by: '7d_increase',
      page: '-1',
    });

    expect(result2.success).toBe(false);
  });

  it('limit が100を超える場合、バリデーションエラーを返す', () => {
    const result = TrendsDailyQuerySchema.safeParse({
      sort_by: '7d_increase',
      limit: '101',
    });

    expect(result.success).toBe(false);
  });

  it('数値文字列を正しく変換する', () => {
    const result = TrendsDailyQuerySchema.safeParse({
      sort_by: '7d_increase',
      page: '5',
      limit: '50',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(5);
      expect(result.data.limit).toBe(50);
    }
  });
});
