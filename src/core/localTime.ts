/**
 * Wall-clock time in an IANA time zone, resolved with Intl. Never reads the
 * machine's zone (process.env.TZ) or the system clock.
 */

import type { Instant, Minutes, Weekday } from './types';

/** A calendar date in some time zone. `month` is 1-12. */
export interface LocalDate {
  year: number;
  month: number;
  day: number;
}

const WEEKDAYS: readonly Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** The wall-clock fields of `at` in `timeZone`. */
function wallClock(at: Instant, timeZone: string) {
  const parts: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(at)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return parts as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** The zone's offset from UTC at `at`, in ms (positive east of Greenwich). */
function offsetAt(at: Instant, timeZone: string): number {
  const w = wallClock(at, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - (at - (((at % 1000) + 1000) % 1000));
}

/** The calendar date of `at` in `timeZone`. */
export function localDateOf(at: Instant, timeZone: string): LocalDate {
  const { year, month, day } = wallClock(at, timeZone);
  return { year, month, day };
}

/** The date `days` calendar days after `date`. */
export function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function weekdayOf(date: LocalDate): Weekday {
  return WEEKDAYS[new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()];
}

/**
 * The instant at which the wall clock in `timeZone` reads `minutes` after
 * midnight on `date`. A wall time repeated by a DST fall-back resolves to its
 * first occurrence; one skipped by a spring-forward resolves to the same
 * distance past the jump (02:30 becomes 03:30).
 */
export function instantAt(date: LocalDate, minutes: Minutes, timeZone: string): Instant {
  const wall = Date.UTC(date.year, date.month - 1, date.day) + minutes * MINUTE;
  const before = wall - offsetAt(wall - 12 * HOUR, timeZone);
  const after = wall - offsetAt(wall + 12 * HOUR, timeZone);
  const matches = [before, after].filter((at) => at + offsetAt(at, timeZone) === wall);
  return matches.length > 0 ? Math.min(...matches) : before;
}
