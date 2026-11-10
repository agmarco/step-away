/**
 * Pause and Day Off, as Today shows them: the hero's status line and today's
 * Pause lines.
 */

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

/** The hero's status at `now`. */
export function heroStatus(_state: CoreState, _now: Instant): HeroStatus {
  throw new Error('heroStatus: not implemented (#26 CP2)');
}

/** Today's Pauses (local date of `now`, Settings' time zone), oldest first. */
export function todaysPauses(_state: CoreState, _now: Instant): Pause[] {
  throw new Error('todaysPauses: not implemented (#26 CP2)');
}
