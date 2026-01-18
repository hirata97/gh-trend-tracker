/**
 * ユーティリティ関数
 */

/**
 * 今日の日付をISO形式（YYYY-MM-DD）で取得
 */
export function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * 文字列を正の整数として解析し、バリデーションする
 * @returns 正の整数、または無効な場合はnull
 */
export function parsePositiveInt(value: string): number | null {
  const parsed = parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

/**
 * N日前の日付をISO形式で取得
 */
export function getDaysAgoISO(days: number): string {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date.toISOString().split('T')[0];
}
