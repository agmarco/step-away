/**
 * Per-day facts derived from the Reminders, for Today: which day a Reminder
 * belongs to (the local date, Settings' time zone, of its first fire; a Snooze
 * re-fire doesn't move it), the Daily Goal, Goal Days, the Streak, the tally
 * and the week panel.
 */

import type { LocalDate } from './localTime';
import type { CoreState, Instant } from './types';

/** The Daily Goal with no change recorded. */
export const DEFAULT_DAILY_GOAL = 4;

/** One day's counts: Done, skipped and Missed Reminders, and the Exercises in its Done lists. Dropped and still-scheduled ones aren't counted. */
export interface Tally {
  done: number;
  skipped: number;
  missed: number;
  exercises: number;
}

/** One day of the week panel. */
export type DayMark = 'goal' | 'missed' | 'off' | 'today' | 'future';

/** The Daily Goal a day is judged against: the last change from on or before it, else 4. */
export function dailyGoalFor(_state: CoreState, _date: LocalDate): number {
  throw new Error('not implemented');
}

/** Whether the day's Done Reminders reach that day's Daily Goal. */
export function isGoalDay(_state: CoreState, _date: LocalDate): boolean {
  throw new Error('not implemented');
}

/** The tally of the Reminders belonging to `date`. */
export function dayTally(_state: CoreState, _date: LocalDate): Tally {
  throw new Error('not implemented');
}

/** The tally of today (the local date of `now`). */
export function todayTally(_state: CoreState, _now: Instant): Tally {
  throw new Error('not implemented');
}

/**
 * Consecutive Goal Days backwards from today (if already a Goal Day) or
 * yesterday, skipping days without Active Hours; the first earlier day with
 * Active Hours that isn't a Goal Day ends it.
 */
export function streak(_state: CoreState, _now: Instant): number {
  throw new Error('not implemented');
}

/** Mon-Fri of the current week (the local week of `now`), one mark per day. */
export function weekMarks(_state: CoreState, _now: Instant): { date: LocalDate; mark: DayMark }[] {
  throw new Error('not implemented');
}
