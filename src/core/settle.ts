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

/** Whether a Reminder's Snooze re-fire lands at or after its day's window end, so it is never scheduled. */
function refirePastClosing(reminder: Reminder, settings: Settings): boolean {
  return reminder.refiresAt !== undefined && reminder.refiresAt >= windowEndOf(reminder.firesAt, settings);
}

/**
 * Whether a snoozed Reminder is coming back: still `scheduled`, its re-fire
 * ahead of `now` and before its day's window end. A re-fire past closing is
 * never scheduled (it settles as dropped).
 */
export function refireScheduled(reminder: Reminder, settings: Settings, now: Instant): boolean {
  return reminder.status === 'scheduled' && refirePending(reminder, now) && !refirePastClosing(reminder, settings);
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
  // "A later Reminder has fired" compares fire times only, not other Reminders'
  // re-fires: the chain always counts from the latest re-fire, so no Reminder
  // fires between a re-fire and the next chain entry (unlike `latestFired` in
  // schedule.ts, which needs the re-fire to pick the outstanding one).
  let latestFiresAt = -Infinity;
  for (const r of state.reminders) if (r.firesAt <= now && r.firesAt > latestFiresAt) latestFiresAt = r.firesAt;

  let changed = false;
  const reminders = state.reminders.map((r) => {
    const status = settledStatus(r, state.settings, now, latestFiresAt);
    if (status === r.status) return r;
    changed = true;
    return { ...r, status };
  });
  return changed ? { ...state, reminders } : state;
}

function settledStatus(r: Reminder, settings: Settings, now: Instant, latestFiresAt: Instant): Reminder['status'] {
  if (r.status !== 'scheduled' || r.firesAt > now) return r.status;
  const fire = effectiveFire(r);
  const end = windowEndOf(r.firesAt, settings);
  if (refirePastClosing(r, settings)) return end <= now ? 'dropped' : r.status;
  if (fire > now) return r.status;
  if (latestFiresAt > fire || end <= now) return 'missed';
  return r.status;
}
