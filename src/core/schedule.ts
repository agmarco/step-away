/**
 * The chain of upcoming Reminders: no-Response fallbacks one Interval apart,
 * within Active Hours in the Settings' time zone, over a 7-day horizon.
 * Recomputed whenever JS runs, because nothing runs when a notification fires.
 */

import { addDays, instantAt, localDateOf, weekdayOf } from './localTime';
import type { CoreState, Instant } from './types';

const MINUTE = 60_000;
const HORIZON_DAYS = 7;
const HORIZON = HORIZON_DAYS * 24 * 60 * MINUTE;

/** A Reminder's Id: deterministic from its fire time. */
export function reminderId(firesAt: Instant): string {
  return `reminder-${firesAt}`;
}

/** The latest Reminder that has fired by `now` (any status), or undefined. */
export function latestFired(state: CoreState, now: Instant) {
  let latest: CoreState['reminders'][number] | undefined;
  for (const r of state.reminders) {
    if (r.firesAt <= now && (!latest || r.firesAt > latest.firesAt)) latest = r;
  }
  return latest;
}

/**
 * The fire times of the chain, oldest first: all strictly after `now` and
 * strictly before `now` + 7 days.
 *
 * Today the chain runs one Interval after the anchor, the later of the last
 * Response and the latest fired Reminder, counted only if it falls inside
 * today's Active Hours. Without an anchor today it takes the day's grid
 * (start + Interval + k·Interval) from the next slot after `now`, with no
 * backfill. Every other day starts one Interval after its Active Hours begin.
 * Each day stops before its window end.
 */
export function chainTimes(state: CoreState, now: Instant): Instant[] {
  const { activeHours, intervalMinutes, timeZone } = state.settings;
  const step = intervalMinutes * MINUTE;
  const horizon = now + HORIZON;
  const today = localDateOf(now, timeZone);
  const times: Instant[] = [];

  for (let offset = 0; offset <= HORIZON_DAYS; offset++) {
    const date = addDays(today, offset);
    const window = activeHours[weekdayOf(date)];
    if (!window) continue;
    const start = instantAt(date, window.start, timeZone);
    const end = instantAt(date, window.end, timeZone);

    let first = start + step;
    if (offset === 0) {
      const anchor = Math.max(state.lastResponseAt ?? -Infinity, latestFired(state, now)?.firesAt ?? -Infinity);
      if (anchor >= start && anchor < end) first = anchor + step;
    }
    for (let t = first; t < end && t < horizon; t += step) {
      if (t > now) times.push(t);
    }
  }
  return times;
}
