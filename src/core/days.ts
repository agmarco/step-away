/**
 * Per-day facts derived from the Reminders, for Today: which day a Reminder
 * belongs to (the local date, Settings' time zone, of its first fire; a Snooze
 * re-fire doesn't move it), the Daily Goal, Goal Days, the Streak, the tally
 * and the week panel.
 */

import { addDays, localDateOf, weekdayOf, type LocalDate } from './localTime';
import type { CoreState, Instant, Reminder, Weekday } from './types';

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
export type DayMark = 'goal' | 'missed' | 'off' | 'today' | 'future' | 'dayOff';

/**
 * The Daily Goal a day is judged against: the last change whose `from` is on
 * or before `date`, else `DEFAULT_DAILY_GOAL`.
 */
export function dailyGoalFor(state: CoreState, date: LocalDate): number {
  const day = dateKey(date);
  let goal = DEFAULT_DAILY_GOAL;
  for (const change of state.goalChanges) if (dateKey(change.from) <= day) goal = change.goal;
  return goal;
}

/** Whether the day's Done Reminders reach that day's Daily Goal. */
export function isGoalDay(state: CoreState, date: LocalDate): boolean {
  return dayTally(state, date).done >= dailyGoalFor(state, date);
}

/** The tally of the Reminders belonging to `date` (see `dayOf`). */
export function dayTally(state: CoreState, date: LocalDate): Tally {
  const day = dateKey(date);
  const tally: Tally = { done: 0, skipped: 0, missed: 0, exercises: 0 };
  for (const r of state.reminders) {
    if (dateKey(dayOf(r, state.settings.timeZone)) !== day) continue;
    if (r.status === 'done') {
      tally.done += 1;
      tally.exercises += r.done?.length ?? 0;
    } else if (r.status === 'skipped') tally.skipped += 1;
    else if (r.status === 'missed') tally.missed += 1;
  }
  return tally;
}

/** The tally of today (the local date of `now`). */
export function todayTally(state: CoreState, now: Instant): Tally {
  return dayTally(state, localDateOf(now, state.settings.timeZone));
}

/** Whether `date` is a Day Off. */
export function isDayOff(state: CoreState, date: LocalDate): boolean {
  const day = dateKey(date);
  return state.daysOff.some((d) => dateKey(d) === day);
}

/**
 * Consecutive Goal Days backwards from today (if already a Goal Day) or
 * yesterday, skipping Days Off and days without Active Hours (by the current
 * Settings' weekdays), even a day that reached its goal; the first earlier
 * day with Active Hours that isn't a Goal Day ends it. A Pause gets nothing
 * special: a paused day is judged as usual. It looks back no further than the
 * earliest Reminder's day: before it no day can be a Goal Day.
 */
export function streak(state: CoreState, now: Instant): number {
  const { timeZone, activeHours } = state.settings;
  let earliest = Infinity;
  for (const r of state.reminders) earliest = Math.min(earliest, dateKey(dayOf(r, timeZone)));
  const counts = (date: LocalDate) => Boolean(activeHours[weekdayOf(date)]) && !isDayOff(state, date);

  const today = localDateOf(now, timeZone);
  let count = counts(today) && isGoalDay(state, today) ? 1 : 0;
  for (let date = addDays(today, -1); dateKey(date) >= earliest; date = addDays(date, -1)) {
    if (!counts(date)) continue;
    if (!isGoalDay(state, date)) break;
    count += 1;
  }
  return count;
}

/**
 * Mon-Fri of the current week (the local week of `now`, Monday to Sunday),
 * one mark per day, in this order of precedence: `today` (even if already a
 * Goal Day or a Day Off), `dayOff`, `future`, `off` (no Active Hours by the
 * current Settings), `goal`, else `missed`.
 */
export function weekMarks(state: CoreState, now: Instant): { date: LocalDate; mark: DayMark }[] {
  const today = localDateOf(now, state.settings.timeZone);
  const monday = addDays(today, -DAYS_SINCE_MONDAY[weekdayOf(today)]);
  const marks: { date: LocalDate; mark: DayMark }[] = [];
  for (let i = 0; i < 5; i++) {
    const date = addDays(monday, i);
    marks.push({ date, mark: markFor(state, date, today) });
  }
  return marks;
}

/** The day a Reminder belongs to: the local date of its first fire, `firesAt` (a Snooze re-fire doesn't move it). */
export function dayOf(reminder: Reminder, timeZone: string): LocalDate {
  return localDateOf(reminder.firesAt, timeZone);
}

/** Whether `a` and `b` are the same calendar date. */
export function sameDate(a: LocalDate, b: LocalDate): boolean {
  return dateKey(a) === dateKey(b);
}

const DAYS_SINCE_MONDAY: Record<Weekday, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

function markFor(state: CoreState, date: LocalDate, today: LocalDate): DayMark {
  const day = dateKey(date);
  if (day === dateKey(today)) return 'today';
  if (isDayOff(state, date)) return 'dayOff';
  if (day > dateKey(today)) return 'future';
  if (!state.settings.activeHours[weekdayOf(date)]) return 'off';
  return isGoalDay(state, date) ? 'goal' : 'missed';
}

/** A number that orders dates: YYYYMMDD. */
export function dateKey({ year, month, day }: LocalDate): number {
  return year * 10_000 + month * 100 + day;
}
