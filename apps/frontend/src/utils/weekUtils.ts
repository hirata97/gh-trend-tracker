/**
 * ISO週番号に関するユーティリティ関数
 */

/**
 * ISO週番号から日付範囲を計算
 * ISO 8601週番号: 週は月曜日から始まり、年の最初の木曜日を含む週が第1週
 *
 * @param year - ISO年
 * @param week - ISO週番号 (1-53)
 * @returns 週の開始日と終了日
 */
export function getWeekDateRange(
  year: number,
  week: number
): { start: Date; end: Date } {
  // ISO週番号の第1週の月曜日を計算
  // 1月4日は必ず第1週に含まれる
  const jan4 = new Date(year, 0, 4);
  // 1月4日の曜日を取得（0=日曜, 1=月曜, ...）
  const jan4DayOfWeek = jan4.getDay();
  // 月曜日を0とする曜日（0=月曜, 6=日曜）
  const jan4DayOfWeekMonZero = jan4DayOfWeek === 0 ? 6 : jan4DayOfWeek - 1;

  // 第1週の月曜日の日付を計算
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - jan4DayOfWeekMonZero);

  // 指定された週の月曜日を計算
  const weekStart = new Date(firstMonday);
  weekStart.setDate(firstMonday.getDate() + (week - 1) * 7);

  // 週の終わり（日曜日）を計算
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return { start: weekStart, end: weekEnd };
}

/**
 * 日付をフォーマット（M/D形式）
 *
 * @param date - フォーマット対象の日付
 * @returns M/D形式の文字列
 */
export function formatDateMD(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}

/**
 * 週の日付範囲を表示用文字列に変換
 *
 * @param year - ISO年
 * @param week - ISO週番号
 * @returns 日付範囲の文字列（例: "1/27-2/2"）
 */
export function formatWeekRange(year: number, week: number): string {
  const { start, end } = getWeekDateRange(year, week);
  return `${formatDateMD(start)}-${formatDateMD(end)}`;
}
