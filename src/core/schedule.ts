/**
 * The chain of upcoming Reminders: no-Response fallbacks one Interval apart,
 * within Active Hours in the Settings' time zone, over a 7-day horizon.
 * Recomputed whenever JS runs, because nothing runs when a notification fires.
 */

import { addDays, instantAt, localDateOf, MINUTE, weekdayOf } from './localTime';
import { effectiveFire, refirePending, refireScheduled, settle } from './settle';
import type { CoreState, Instant, Reminder } from './types';

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

/**
 * The next Reminder ahead, or undefined: the earliest of the first one still
 * scheduled that fires strictly after `now` and any pending Snooze re-fire (a
 * fired Reminder still `scheduled` whose `refiresAt` is after `now`), compared
 * by `effectiveFire`. A re-fire landing at or after its day's window end is
 * never scheduled (it settles as dropped), so it doesn't count.
 */
export function nextReminder(state: CoreState, now: Instant): Reminder | undefined {
  let next = state.reminders.find((r) => r.firesAt > now && r.status === 'scheduled');
  for (const r of state.reminders) {
    if (r.firesAt > now || !refireScheduled(r, state.settings, now)) continue;
    if (!next || effectiveFire(r) < effectiveFire(next)) next = r;
  }
  return next;
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

/**
 * The latest Reminder that has fired by `now` (any status), by effective fire
 * (its pending or latest Snooze re-fire, else its fire time), or undefined.
 */
function latestFired(state: CoreState, now: Instant): Reminder | undefined {
  let latest: Reminder | undefined;
  for (const r of state.reminders) {
    if (r.firesAt <= now && (!latest || effectiveFire(r) > effectiveFire(latest))) latest = r;
  }
  return latest;
}

/**
 * The Reminder a Response can still act on, once settled: the latest fired
 * one by effective fire, while it is still `scheduled` and its Snooze re-fire
 * (if any) has fired. Anything else (unknown, not fired yet, superseded by a
 * later fired one, already answered, Missed or dropped at closing, re-fire
 * still pending) is a guarded no-op. Adapters use it too, e.g. to dismiss
 * stale notifications.
 */
export function outstandingReminder(state: CoreState, now: Instant): Reminder | undefined {
  const latest = latestFired(settle(state, now), now);
  return latest?.status === 'scheduled' && !refirePending(latest, now) ? latest : undefined;
}

/**
 * The fire times of the chain, oldest first: all strictly after `now` and
 * strictly before `now` + 7 days.
 *
 * Today the chain runs one Interval after the anchor, the later of the last
 * Response and the latest fire (a fired Reminder, or its pending or latest
 * Snooze re-fire), counted only if it falls inside
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
  const latest = latestFired(state, now);
  const latestFire = latest ? effectiveFire(latest) : -Infinity;

  for (let offset = 0; offset <= HORIZON_DAYS; offset++) {
    const date = addDays(today, offset);
    const window = activeHours[weekdayOf(date)];
    if (!window) continue;
    const start = instantAt(date, window.start, timeZone);
    const end = instantAt(date, window.end, timeZone);

    let first = start + step;
    if (offset === 0) {
      const anchor = Math.max(state.lastResponseAt ?? -Infinity, latestFire);
      if (anchor >= start && anchor < end) first = anchor + step;
    }
    for (let t = first; t < end && t < horizon; t += step) {
      if (t > now) times.push(t);
    }
  }
  return times;
}
