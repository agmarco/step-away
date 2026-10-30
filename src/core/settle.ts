/**
 * Settling: recording, whenever JS runs, the outcomes that happened while it
 * didn't. Nothing runs when a scheduled notification fires, so Missed and
 * dropped are derived from the clock before any event is handled.
 */

import { addDays, instantAt, localDateOf, weekdayOf } from './localTime';
import type { CoreState, Instant, Reminder, Settings } from './types';

/** When a Reminder last fires: its pending or latest Snooze re-fire, else its own fire time. */
export function effectiveFire(reminder: Reminder): Instant {
  return reminder.refiresAt ?? reminder.firesAt;
}

/**
 * The end of the Active Hours of the local day (Settings' time zone) a
 * Reminder belongs to, by its original fire time. A day with no Active Hours
 * (possible after a Settings change, e.g. Test mode switched off) ends at that
 * day's local midnight.
 */
export function windowEndOf(firesAt: Instant, settings: Settings): Instant {
  const date = localDateOf(firesAt, settings.timeZone);
  const window = settings.activeHours[weekdayOf(date)];
  return window ? instantAt(date, window.end, settings.timeZone) : instantAt(addDays(date, 1), 0, settings.timeZone);
}

/** Whether a snoozed Reminder's re-fire is still ahead of `now`. */
export function refirePending(reminder: Reminder, now: Instant): boolean {
  return reminder.refiresAt !== undefined && reminder.refiresAt > now;
}

/**
 * Settles every Reminder still `scheduled`, comparing its effective fire:
 * - dropped: its re-fire lands at or after its day's window end (so it was
 *   never scheduled), once that end has passed;
 * - missed on replacement: it has fired and a later Reminder has fired since;
 * - missed at closing: it has fired and its day's window end has passed.
 * Window end is exclusive: exactly at the end counts as closed. Returns the
 * same state object when nothing changes.
 */
export function settle(state: CoreState, now: Instant): CoreState {
  let latestFired = -Infinity;
  for (const r of state.reminders) if (r.firesAt <= now && r.firesAt > latestFired) latestFired = r.firesAt;

  let changed = false;
  const reminders = state.reminders.map((r) => {
    const status = settledStatus(r, state.settings, now, latestFired);
    if (status === r.status) return r;
    changed = true;
    return { ...r, status };
  });
  return changed ? { ...state, reminders } : state;
}

function settledStatus(r: Reminder, settings: Settings, now: Instant, latestFired: Instant): Reminder['status'] {
  if (r.status !== 'scheduled' || r.firesAt > now) return r.status;
  const fire = effectiveFire(r);
  const end = windowEndOf(r.firesAt, settings);
  if (r.refiresAt !== undefined && r.refiresAt >= end) return end <= now ? 'dropped' : r.status;
  if (fire > now) return r.status;
  if (latestFired > fire || end <= now) return 'missed';
  return r.status;
}
