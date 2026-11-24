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

/** One day of the week panel or the History calendar. */
export type DayMark = 'goal' | 'missed' | 'off' | 'today' | 'future' | 'dayOff' | 'none';

/** A calendar month: `month` runs 1-12. */
export interface YearMonth {
  year: number;
  month: number;
}

/** The month `n` months after `month` (before it when `n` is negative). */
export function addMonths(month: YearMonth, n: number): YearMonth {
  const index = month.year * 12 + (month.month - 1) + n;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

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

/**
 * The Goal Day rule, given the day's Done count: `done` reaches that day's
 * Daily Goal. The one place the rule lives; callers that already counted the
 * day's Done Reminders pass the count, the rest go through `isGoalDay`.
 */
export function reachesDailyGoal(state: CoreState, date: LocalDate, done: number): boolean {
  return done >= dailyGoalFor(state, date);
}

/** Whether the day's Done Reminders reach that day's Daily Goal (`reachesDailyGoal`). */
export function isGoalDay(state: CoreState, date: LocalDate): boolean {
  return reachesDailyGoal(state, date, dayTally(state, date).done);
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
  const earliest = earliestDayKey(state);
  const today = localDateOf(now, state.settings.timeZone);
  let count = countsForStreak(state, today) && isGoalDay(state, today) ? 1 : 0;
  for (let date = addDays(today, -1); dateKey(date) >= earliest; date = addDays(date, -1)) {
    if (!countsForStreak(state, date)) continue;
    if (!isGoalDay(state, date)) break;
    count += 1;
  }
  return count;
}

/**
 * Whether `date` counts for a Streak: it has Active Hours (by the current
 * Settings' weekdays) and isn't a Day Off. A day that doesn't count is
 * skipped, even one that reached its goal.
 */
export function countsForStreak(state: CoreState, date: LocalDate): boolean {
  return Boolean(state.settings.activeHours[weekdayOf(date)]) && !isDayOff(state, date);
}

/** The Monday of `date`'s local week (weeks run Monday to Sunday). */
export function mondayOf(date: LocalDate): LocalDate {
  return addDays(date, -DAYS_SINCE_MONDAY[weekdayOf(date)]);
}

/**
 * Mon-Fri of the current week (the local week of `now`, Monday to Sunday),
 * one mark per day, in this order of precedence: `today` (even if already a
 * Goal Day or a Day Off), `dayOff`, `future`, `none` (a past day before the
 * earliest Reminder's day, or any past day when there are no Reminders: no
 * data yet), `off` (no Active Hours by the current Settings), `goal`, else
 * `missed`.
 */
export function weekMarks(state: CoreState, now: Instant): { date: LocalDate; mark: DayMark }[] {
  const today = localDateOf(now, state.settings.timeZone);
  const monday = mondayOf(today);
  const earliest = earliestDayKey(state);
  const marks: { date: LocalDate; mark: DayMark }[] = [];
  for (let i = 0; i < 5; i++) {
    const date = addDays(monday, i);
    marks.push({ date, mark: markFor(state, date, today, earliest) });
  }
  return marks;
}

/** Every date of `month`, in order, one mark per day, by the same rule as `weekMarks`. */
export function monthMarks(state: CoreState, month: YearMonth, now: Instant): { date: LocalDate; mark: DayMark }[] {
  const today = localDateOf(now, state.settings.timeZone);
  const earliest = earliestDayKey(state);
  const marks: { date: LocalDate; mark: DayMark }[] = [];
  for (let date = { ...month, day: 1 }; date.month === month.month; date = addDays(date, 1)) {
    marks.push({ date, mark: markFor(state, date, today, earliest) });
  }
  return marks;
}

/**
 * The months History can show: from the month of the earliest Reminder's day
 * (the current month when there are none or that is later) to 12 months past
 * the current month.
 */
export function historyRange(state: CoreState, now: Instant): { first: YearMonth; last: YearMonth } {
  const { year, month } = localDateOf(now, state.settings.timeZone);
  const current = { year, month };
  const earliest = earliestDayKey(state);
  const first =
    earliest < dateKey({ ...current, day: 1 })
      ? { year: Math.floor(earliest / 10_000), month: Math.floor(earliest / 100) % 100 }
      : current;
  return { first, last: addMonths(current, 12) };
}

/**
 * The `dateKey` of the earliest Reminder's day (see `dayOf`), or Infinity
 * when there are no Reminders: before it no day has data. Callers that judge
 * many days compute it once and pass it on.
 */
function earliestDayKey(state: CoreState): number {
  let earliest = Infinity;
  for (const r of state.reminders) earliest = Math.min(earliest, dateKey(dayOf(r, state.settings.timeZone)));
  return earliest;
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

/** One day's mark, by the precedence in `weekMarks`; `earliest` is `earliestDayKey(state)`. */
function markFor(state: CoreState, date: LocalDate, today: LocalDate, earliest: number): DayMark {
  const day = dateKey(date);
  if (day === dateKey(today)) return 'today';
  if (isDayOff(state, date)) return 'dayOff';
  if (day > dateKey(today)) return 'future';
  if (day < earliest) return 'none';
  if (!state.settings.activeHours[weekdayOf(date)]) return 'off';
  return isGoalDay(state, date) ? 'goal' : 'missed';
}

/** A number that orders dates: YYYYMMDD. */
export function dateKey({ year, month, day }: LocalDate): number {
  return year * 10_000 + month * 100 + day;
}
