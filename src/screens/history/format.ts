import type { LocalDate, YearMonth } from '../../core';

/**
 * Display-only formatting of calendar dates for History (device locale). A
 * date is formatted at its UTC midnight in UTC, so the device's time zone
 * can't shift it to the day before or after.
 */

const utc = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));

/** "Tuesday 3 November", in the device's order. */
export const longDayOf = ({ year, month, day }: LocalDate) =>
  utc(year, month, day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** "November 2026", in the device's order. */
export const monthTitleOf = ({ year, month }: YearMonth) =>
  utc(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
