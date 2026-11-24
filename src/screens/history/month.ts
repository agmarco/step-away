import type { LocalDate, YearMonth } from '../../core';

/**
 * Month arithmetic for the History calendar, whose weeks run Monday to
 * Sunday (as the core's weeks do).
 */

/** How many empty cells come before the 1st of `month` in a Monday-first week row: 0 (Monday) to 6 (Sunday). */
export function leadingBlanks(month: YearMonth): number {
  const sundayFirst = new Date(Date.UTC(month.year, month.month - 1, 1)).getUTCDay();
  return (sundayFirst + 6) % 7;
}

/**
 * `days` (the month's days in order, one per day) as Monday-first week rows
 * of exactly seven: blanks (null) before the 1st, by `leadingBlanks`, and
 * after the last day to fill the last row.
 */
export function weeksOf<T>(month: YearMonth, days: readonly T[]): (T | null)[][] {
  const cells: (T | null)[] = [...Array.from({ length: leadingBlanks(month) }, () => null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (T | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
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

/**
 * The selected day after History steps to `month`: today when `month` holds
 * it, else nothing, so a selection never outlives its month.
 */
export function selectionAfterStep(month: YearMonth, today: LocalDate): LocalDate | null {
  return month.year === today.year && month.month === today.month ? today : null;
}
