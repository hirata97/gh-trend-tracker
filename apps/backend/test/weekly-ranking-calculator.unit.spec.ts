import { describe, it, expect } from 'vitest';
import {
  getISOWeekInfo,
  getISOWeekRange,
} from '../src/services/weekly-ranking-calculator';

describe('getISOWeekInfo', () => {
  it('2026-01-05（月曜）はW02であること', () => {
    const result = getISOWeekInfo(new Date('2026-01-05'));
    expect(result).toEqual({ year: 2026, weekNumber: 2 });
  });

  it('2026-01-01（木曜）はW01であること', () => {
    const result = getISOWeekInfo(new Date('2026-01-01'));
    expect(result).toEqual({ year: 2026, weekNumber: 1 });
  });

  it('2025-12-29（月曜）は2026年W01であること（ISO週の年またぎ）', () => {
    const result = getISOWeekInfo(new Date('2025-12-29'));
    expect(result).toEqual({ year: 2026, weekNumber: 1 });
  });

  it('2025-12-28（日曜）は2025年W52であること', () => {
    const result = getISOWeekInfo(new Date('2025-12-28'));
    expect(result).toEqual({ year: 2025, weekNumber: 52 });
  });

  it('2026-02-02（月曜）はW06であること', () => {
    const result = getISOWeekInfo(new Date('2026-02-02'));
    expect(result).toEqual({ year: 2026, weekNumber: 6 });
  });
});

describe('getISOWeekRange', () => {
  it('2026年W02の範囲は1/5〜1/11であること', () => {
    const result = getISOWeekRange(2026, 2);
    expect(result).toEqual({ startDate: '2026-01-05', endDate: '2026-01-11' });
  });

  it('2026年W01の範囲は12/29〜1/4であること（年またぎ）', () => {
    const result = getISOWeekRange(2026, 1);
    expect(result).toEqual({ startDate: '2025-12-29', endDate: '2026-01-04' });
  });

  it('2026年W06の範囲は2/2〜2/8であること', () => {
    const result = getISOWeekRange(2026, 6);
    expect(result).toEqual({ startDate: '2026-02-02', endDate: '2026-02-08' });
  });
});
