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
 * N日前の日付をISO形式で取得
 */
export function getDaysAgoISO(days: number): string {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date.toISOString().split('T')[0];
}
