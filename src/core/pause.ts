/**
 * Pause and Day Off, as Today shows them: the hero's status line and today's
 * Pause lines.
 */

import { isDayOff, sameDate } from './days';
import { instantAt, localDateOf, type LocalDate } from './localTime';
import { nextReminder, outstandingReminder } from './schedule';
import type { CoreState, Instant, Pause } from './types';

/**
 * What the Today hero shows: Reminders are off (notifications blocked; no
 * hero action), a Day Off (with Undo), a running Pause (with Resume), the next
 * Reminder (with Pause; `snoozed` when it is a Snooze re-fire), or nothing
 * scheduled.
 */
export type HeroStatus =
  | { kind: 'dayOff' }
  | { kind: 'paused'; until: Instant }
  | { kind: 'next'; at: Instant; snoozed: boolean }
  | { kind: 'none' }
  | { kind: 'off' };

/**
 * Whether the device lets the app post notifications. A device fact the
 * adapters read, never stored in `CoreState`; in the core only `heroStatus`
 * (and so `canPause`) reads it. Scheduling ignores it.
 */
export type NotificationsState = 'allowed' | 'blocked';

/**
 * The hero's status at `now`. When states overlap: `off` (`notifications` is
 * `'blocked'`) > `dayOff` (today is a Day Off) > `paused` (a Pause is running:
 * `from <= now < until`; one not started yet doesn't count) > `next`
 * (`nextReminder`) > `none`. `notifications` absent means `'allowed'`.
 */
export function heroStatus(state: CoreState, now: Instant, notifications?: NotificationsState): HeroStatus {
  if (notifications === 'blocked') return { kind: 'off' };
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
 * Whether a Pause at `now` would do something, so the hero offers it. Never
 * while `heroStatus` is `off`, `dayOff` or `paused`. Otherwise always while a
 * Reminder is outstanding (`outstandingReminder`), which the Pause drops, even
 * under `none`; and under `next` when that next Reminder (its re-fire time
 * when snoozed) falls on today in the Settings' time zone. After the day's
 * last Reminder, with nothing outstanding, a Pause would only record a line.
 * `status` defaults to `heroStatus(state, now)` (notifications allowed); a
 * caller that already has it passes it, so only a passed status can be `off`.
 * Screens use it to show or hide Pause.
 */
export function canPause(state: CoreState, now: Instant, status: HeroStatus = heroStatus(state, now)): boolean {
  if (status.kind === 'off' || status.kind === 'dayOff' || status.kind === 'paused') return false;
  if (outstandingReminder(state, now) !== undefined) return true;
  if (status.kind !== 'next') return false;
  const { timeZone } = state.settings;
  return sameDate(localDateOf(status.at, timeZone), localDateOf(now, timeZone));
}

/** Today's Pauses (by the local date of `from`, Settings' time zone), oldest first. */
export function todaysPauses(state: CoreState, now: Instant): Pause[] {
  const { timeZone } = state.settings;
  const today = localDateOf(now, timeZone);
  return state.pauses.filter((p) => sameDate(localDateOf(p.from, timeZone), today));
}

/** The Pauses whose `from` falls on `date` (Settings' time zone), oldest first. */
export function pausesOn(_state: CoreState, _date: LocalDate): Pause[] {
  throw new Error('not implemented');
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
