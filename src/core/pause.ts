/**
 * Pause and Day Off, as Today shows them: the hero's status line and today's
 * Pause lines.
 */

import { isDayOff, sameDate } from './days';
import { localDateOf } from './localTime';
import { nextReminder } from './schedule';
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

/** Today's Pauses (by the local date of `from`, Settings' time zone), oldest first. */
export function todaysPauses(state: CoreState, now: Instant): Pause[] {
  const { timeZone } = state.settings;
  const today = localDateOf(now, timeZone);
  return state.pauses.filter((p) => sameDate(localDateOf(p.from, timeZone), today));
}

/** The Pause running at `now` (`from <= now < until`), or undefined. */
export function runningPause(state: CoreState, now: Instant): Pause | undefined {
  return state.pauses.find((p) => p.from <= now && now < p.until);
}
