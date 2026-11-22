/**
 * Pause and Day Off, as Today shows them: the hero's status line and today's
 * Pause lines.
 */

import { isDayOff, sameDate } from './days';
import { instantAt, localDateOf } from './localTime';
import { nextReminder, outstandingReminder } from './schedule';
import type { CoreState, Instant, Pause } from './types';

/**
 * What the Today hero shows: a Day Off (with Undo), a running Pause (with
 * Resume), the next Reminder (with Pause; `snoozed` when it is a Snooze
 * re-fire), or nothing scheduled.
 */
export type HeroStatus =
  | { kind: 'dayOff' }
  | { kind: 'paused'; until: Instant }
  | { kind: 'next'; at: Instant; snoozed: boolean }
  | { kind: 'none' };

/**
 * The hero's status at `now`. When states overlap: `dayOff` (today is a Day
 * Off) > `paused` (a Pause is running: `from <= now < until`; one not started
 * yet doesn't count) > `next` (`nextReminder`) > `none`.
 */
export function heroStatus(state: CoreState, now: Instant): HeroStatus {
  if (isDayOff(state, localDateOf(now, state.settings.timeZone))) return { kind: 'dayOff' };
  const running = runningPause(state, now);
  if (running) return { kind: 'paused', until: running.until };
  const next = nextReminder(state, now);
  if (!next) return { kind: 'none' };
  // A fired Reminder that is next can only be a pending Snooze re-fire.
  const snoozed = next.firesAt <= now;
  return { kind: 'next', at: snoozed ? (next.refiresAt ?? next.firesAt) : next.firesAt, snoozed };
}

/**
 * Whether a Pause at `now` would do something, so the hero offers it: only
 * while `heroStatus` is `next`, and then when that next Reminder (its re-fire
 * time when snoozed) falls on today in the Settings' time zone, or a Reminder
 * is outstanding (`outstandingReminder`), which the Pause drops. After the
 * day's last Reminder, with nothing outstanding, a Pause would only record a
 * line. Screens use it to show or hide Pause.
 */
export function canPause(state: CoreState, now: Instant): boolean {
  const status = heroStatus(state, now);
  if (status.kind !== 'next') return false;
  const { timeZone } = state.settings;
  return sameDate(localDateOf(status.at, timeZone), localDateOf(now, timeZone)) || outstandingReminder(state, now) !== undefined;
}

/** Today's Pauses (by the local date of `from`, Settings' time zone), oldest first. */
export function todaysPauses(state: CoreState, now: Instant): Pause[] {
  const { timeZone } = state.settings;
  const today = localDateOf(now, timeZone);
  return state.pauses.filter((p) => sameDate(localDateOf(p.from, timeZone), today));
}

/** The Pause running at `now` (`isRunning`), or undefined. */
export function runningPause(state: CoreState, now: Instant): Pause | undefined {
  return state.pauses.find((p) => isRunning(p, now));
}

/** Whether `pause` is running at `now`: `from <= now < until`. */
export function isRunning(pause: Pause, now: Instant): boolean {
  return pause.from <= now && now < pause.until;
}

/**
 * Whether `until` is a local midnight in `timeZone` (the Settings' time zone),
 * as a Pause for the rest of today ends: the hero then says "Paused for the
 * rest of today" instead of a time.
 */
export function endsAtMidnight(until: Instant, timeZone: string): boolean {
  return until === instantAt(localDateOf(until, timeZone), 0, timeZone);
}

