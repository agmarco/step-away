/**
 * Per-day facts derived from the Reminders, for Today, History and
 * Achievements: which day a Reminder belongs to (the local date, Settings'
 * time zone, of its first fire; a Snooze re-fire doesn't move it), the Daily
 * Goal, Goal Days, the Streak, the tally, the week panel, History's calendar
 * and the Activity Log by day (`logByDay`).
 */

import type { BodyArea } from './exercise';
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

/** Not implemented yet (#65 CP2 red). */
export function monthBefore(_a: YearMonth, _b: YearMonth): boolean {
  return false;
}

/** Not implemented yet (#65 CP2 red). */
export function sameMonth(_a: YearMonth, _b: YearMonth): boolean {
  return false;
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

/**
 * Whether the day's Done Reminders reach that day's Daily Goal
 * (`reachesDailyGoal`). It scans every Reminder: for a single day; callers
 * that judge many days build `logByDay` once instead.
 */
export function isGoalDay(state: CoreState, date: LocalDate): boolean {
  return reachesDailyGoal(state, date, dayTally(state, date).done);
}

/** The tally of the Reminders belonging to `date` (see `dayOf`). It scans every Reminder: for a single day (Today, History's day panel). */
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

/** Not implemented yet (#65 CP2 red). */
export function canSetDayOff(_state: CoreState, _date: LocalDate, _now: Instant): boolean {
  return false;
}

/**
 * Consecutive Goal Days backwards from today (if already a Goal Day) or
 * yesterday, skipping Days Off and days without Active Hours (by the current
 * Settings' weekdays), even a day that reached its goal; the first earlier
 * day with Active Hours that isn't a Goal Day ends it. A Pause gets nothing
 * special: a paused day is judged as usual. It looks back no further than the
 * earliest Reminder's day: before it no day can be a Goal Day. Each day is
 * judged on its Done count in `logByDay`: one pass over the Reminders plus
 * one step per day.
 */
export function streak(state: CoreState, now: Instant): number {
  const log = logByDay(state);
  const isGoal = (date: LocalDate) => reachesDailyGoal(state, date, log.days.get(dateKey(date))?.done ?? 0);
  const earliest = log.earliest ? dateKey(log.earliest) : Infinity;
  const today = localDateOf(now, state.settings.timeZone);
  let count = countsForStreak(state, today) && isGoal(today) ? 1 : 0;
  for (let date = addDays(today, -1); dateKey(date) >= earliest; date = addDays(date, -1)) {
    if (!countsForStreak(state, date)) continue;
    if (!isGoal(date)) break;
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
  const log = logByDay(state);
  const marks: { date: LocalDate; mark: DayMark }[] = [];
  for (let i = 0; i < 5; i++) {
    const date = addDays(monday, i);
    marks.push({ date, mark: markFor(state, date, today, log) });
  }
  return marks;
}

/**
 * Every date of `month`, in order, one mark per day, by the same rule as
 * `weekMarks`. One pass over the Reminders (`logByDay`) plus one step per day.
 */
export function monthMarks(state: CoreState, month: YearMonth, now: Instant): { date: LocalDate; mark: DayMark }[] {
  const today = localDateOf(now, state.settings.timeZone);
  const log = logByDay(state);
  const marks: { date: LocalDate; mark: DayMark }[] = [];
  for (let date = { ...month, day: 1 }; date.month === month.month; date = addDays(date, 1)) {
    marks.push({ date, mark: markFor(state, date, today, log) });
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
  const { earliest } = logByDay(state);
  const first =
    earliest && dateKey(earliest) < dateKey({ ...current, day: 1 })
      ? { year: earliest.year, month: earliest.month }
      : current;
  return { first, last: addMonths(current, 12) };
}

/** One day of the Activity Log: its Done, skipped and Missed counts and the Body Areas in its `done` lists. */
export interface LoggedDay {
  date: LocalDate;
  done: number;
  skipped: number;
  missed: number;
  areas: Set<BodyArea>;
}

/** The Activity Log by day (see `logByDay`). */
export interface DayLog {
  /** A `LoggedDay` per day that has a Reminder (`dayOf`, any status), keyed by `dateKey`. */
  days: Map<number, LoggedDay>;
  /** The earliest Reminder's day, undefined when there are no Reminders: before it no day has data. */
  earliest: LocalDate | undefined;
}

/**
 * The Activity Log by day, built in one pass over the Reminders. For callers
 * that judge many days (`streak`, `weekMarks`, `monthMarks`, `historyRange`,
 * the Records and Badges): each looks a day up instead of scanning every
 * Reminder, as `dayTally` does.
 */
export function logByDay(state: CoreState): DayLog {
  const days = new Map<number, LoggedDay>();
  let earliest: LocalDate | undefined;
  for (const r of state.reminders) {
    const date = dayOf(r, state.settings.timeZone);
    const key = dateKey(date);
    let day = days.get(key);
    if (!day) {
      day = { date, done: 0, skipped: 0, missed: 0, areas: new Set() };
      days.set(key, day);
      if (!earliest || key < dateKey(earliest)) earliest = date;
    }
    if (r.status === 'done') {
      day.done += 1;
      for (const e of r.done ?? []) day.areas.add(e.bodyArea);
    } else if (r.status === 'skipped') day.skipped += 1;
    else if (r.status === 'missed') day.missed += 1;
  }
  return { days, earliest };
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

/** One day's mark, by the precedence in `weekMarks`; `log` is `logByDay(state)`, built once by the caller. */
function markFor(state: CoreState, date: LocalDate, today: LocalDate, log: DayLog): DayMark {
  const day = dateKey(date);
  if (day === dateKey(today)) return 'today';
  if (isDayOff(state, date)) return 'dayOff';
  if (day > dateKey(today)) return 'future';
  if (!log.earliest || day < dateKey(log.earliest)) return 'none';
  if (!state.settings.activeHours[weekdayOf(date)]) return 'off';
  return reachesDailyGoal(state, date, log.days.get(day)?.done ?? 0) ? 'goal' : 'missed';
}

/** A number that orders dates: YYYYMMDD. */
export function dateKey({ year, month, day }: LocalDate): number {
  return year * 10_000 + month * 100 + day;
}
