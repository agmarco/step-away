import type { YearMonth } from '../../core';

/**
 * Month arithmetic for the History calendar, whose weeks run Monday to
 * Sunday (as the core's weeks do).
 */

/** How many empty cells come before the 1st of `month` in a Monday-first week row: 0 (Monday) to 6 (Sunday). */
export function leadingBlanks(month: YearMonth): number {
  const sundayFirst = new Date(Date.UTC(month.year, month.month - 1, 1)).getUTCDay();
  return (sundayFirst + 6) % 7;
}

/** The month `by` months after `month` (before it when `by` is negative). */
export function shiftMonth(month: YearMonth, by: number): YearMonth {
  const index = month.year * 12 + (month.month - 1) + by;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Whether `a` comes before `b`. */
export function monthBefore(a: YearMonth, b: YearMonth): boolean {
  return a.year < b.year || (a.year === b.year && a.month < b.month);
}
