import { dateKey, sameDate, sameMonth, type LocalDate, type YearMonth } from '../../core';
import type { DayKind } from './DayPanel';

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

/**
 * The selected day after History steps to `month`: today when `month` holds
 * it (the core's `sameMonth`), else nothing, so a selection never outlives
 * its month.
 */
export function selectionAfterStep(month: YearMonth, today: LocalDate): LocalDate | null {
  return sameMonth(month, today) ? today : null;
}

/** Whether `date` is before `today`, today or after it, by the core's date order (`sameDate`, `dateKey`). */
export function dayKindOf(date: LocalDate, today: LocalDate): DayKind {
  if (sameDate(date, today)) return 'today';
  return dateKey(date) < dateKey(today) ? 'past' : 'future';
}
