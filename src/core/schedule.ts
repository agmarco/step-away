/**
 * The chain of upcoming Reminders: no-Response fallbacks one Interval apart,
 * within Active Hours in the Settings' time zone, over a 7-day horizon.
 * Recomputed whenever JS runs, because nothing runs when a notification fires.
 */

import { addDays, instantAt, localDateOf, weekdayOf } from './localTime';
import type { CoreState, Instant, Reminder } from './types';

const MINUTE = 60_000;
const HORIZON_DAYS = 7;
const HORIZON = HORIZON_DAYS * 24 * 60 * MINUTE;
const REMINDER_ID_PREFIX = 'reminder-';

/** A Reminder's Id: deterministic from its fire time. */
export function reminderId(firesAt: Instant): string {
  return `${REMINDER_ID_PREFIX}${firesAt}`;
}

/** Whether `id` is a Reminder Id (as made by `reminderId`), e.g. to tell Reminder notifications from others. */
export function isReminderId(id: string): boolean {
  return id.startsWith(REMINDER_ID_PREFIX);
}

/** The next Reminder ahead: the first one still scheduled that fires strictly after `now`, or undefined. */
export function nextReminder(state: CoreState, now: Instant): Reminder | undefined {
  return state.reminders.find((r) => r.firesAt > now && r.status === 'scheduled');
}

/** The fired Reminders (any status) whose local date in the Settings' time zone is today, newest first. */
export function todaysReminders(state: CoreState, now: Instant): Reminder[] {
  const { timeZone } = state.settings;
  const today = localDateOf(now, timeZone);
  const isToday = (at: Instant) => {
    const d = localDateOf(at, timeZone);
    return d.year === today.year && d.month === today.month && d.day === today.day;
  };
  return state.reminders.filter((r) => r.firesAt <= now && isToday(r.firesAt)).sort((a, b) => b.firesAt - a.firesAt);
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
 * The Reminder a Response can still act on: the latest fired one, if no
 * Response has been given to it yet. Anything else (unknown, not fired yet,
 * superseded by a later fired one, already answered) is a guarded no-op.
 * Adapters use it too, e.g. to dismiss stale notifications.
 */
export function outstandingReminder(state: CoreState, now: Instant): Reminder | undefined {
  const latest = latestFired(state, now);
  return latest?.status === 'scheduled' ? latest : undefined;
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
