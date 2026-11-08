import type { LocalDate } from '../../core';

/** Display-only date and time formatting for Today (device locale, 24-hour times). */

export const timeOf = (at: number) =>
  new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export const weekdayOf = (at: number) => new Date(at).toLocaleDateString(undefined, { weekday: 'short' });

export const longDateOf = (at: number) =>
  new Date(at).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

/** The calendar date of `at` in `timeZone`, as YYYY-MM-DD, for comparing days. */
export const dateOf = (at: number, timeZone: string) =>
  new Date(at).toLocaleDateString('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Today's calendar date in `timeZone` (the Settings' time zone), for `dailyGoalFor`. */
export function localDateIn(at: number, timeZone: string): LocalDate {
  const [year, month, day] = dateOf(at, timeZone).split('-').map(Number);
  return { year, month, day };
}
