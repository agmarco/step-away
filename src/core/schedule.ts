/**
 * The chain of upcoming Reminders: no-Response fallbacks one Interval apart,
 * within Active Hours in the Settings' time zone, over a 7-day horizon.
 * Recomputed whenever JS runs, because nothing runs when a notification fires.
 */

import { dateKey } from './days';
import { addDays, instantAt, localDateOf, MINUTE, weekdayOf } from './localTime';
import { effectiveFire, refireScheduled, settle } from './settle';
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
 * one by effective fire, while it is still `scheduled`, whether or not a
 * Snooze re-fire is pending (a Done or Skip then cancels the re-fire; a Snooze
 * also needs the re-fire to have fired). A snoozed Reminder whose re-fire
 * lands past closing stays outstanding until its day's window end. Anything
 * else (unknown, not fired yet, superseded by a later fired one, already
 * answered, Missed or dropped at closing) is a guarded no-op. Adapters use it
 * too, e.g. to dismiss stale notifications.
 */
export function outstandingReminder(state: CoreState, now: Instant): Reminder | undefined {
  const latest = latestFired(settle(state, now), now);
  return latest?.status === 'scheduled' ? latest : undefined;
}

/** Whether `reminderId` is the outstanding Reminder at `now` (see `outstandingReminder`). */
export function isOutstanding(state: CoreState, reminderId: string, now: Instant): boolean {
  return outstandingReminder(state, now)?.id === reminderId;
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
 *
 * Days Off have no Reminders. A Pause `[from, until)` overlapping the gap
 * before the next time (from the anchor, or the previous time, up to and
 * including the next one) moves the anchor to its `until`: no time falls
 * inside a Pause, and the first one after it is `until` + Interval, or
 * nothing more that day if that is at or past the window end. So the chain
 * built when a Pause starts already holds the times after it.
 */
export function chainTimes(state: CoreState, now: Instant): Instant[] {
  const { activeHours, intervalMinutes, timeZone } = state.settings;
  const step = intervalMinutes * MINUTE;
  const horizon = now + HORIZON;
  const today = localDateOf(now, timeZone);
  const times: Instant[] = [];
  const latest = latestFired(state, now);
  const latestFire = latest ? effectiveFire(latest) : -Infinity;
  const daysOff = new Set(state.daysOff.map(dateKey));
  // Oldest first and never overlapping; only those ending after today's midnight can matter.
  const todayStart = instantAt(today, 0, timeZone);
  const pauses = state.pauses.filter((p) => p.until > todayStart);
  let p = 0;

  for (let offset = 0; offset <= HORIZON_DAYS; offset++) {
    const date = addDays(today, offset);
    const window = activeHours[weekdayOf(date)];
    if (!window || daysOff.has(dateKey(date))) continue;
    const start = instantAt(date, window.start, timeZone);
    const end = instantAt(date, window.end, timeZone);

    let anchor = start;
    if (offset === 0) {
      const last = Math.max(state.lastResponseAt ?? -Infinity, latestFire);
      if (last >= start && last < end) anchor = last;
    }
    for (let t = anchor + step; t < end && t < horizon; t = anchor + step) {
      while (p < pauses.length && pauses[p].until <= anchor) p++;
      if (p < pauses.length && pauses[p].from <= t) {
        anchor = pauses[p].until;
        continue;
      }
      if (t > now) times.push(t);
      anchor = t;
    }
  }
  return times;
}
