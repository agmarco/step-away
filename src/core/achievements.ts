/**
 * Achievements: the Badge catalogue, the Records and the new-Badge dot (#28).
 * Badges are evaluated inside `reduce` (see `badgesToUnlock`); Records are
 * recomputed on every call.
 */

import { countsForStreak, dailyGoalFor, dateKey, dayOf, isGoalDay, mondayOf } from './days';
import { BODY_AREAS, type BodyArea } from './exercise';
import { addDays, localDateOf, type LocalDate } from './localTime';
import type { CoreState, Instant, UnlockedBadge } from './types';

/** How the Achievements page groups the Badges. */
export type BadgeGroup = 'Streak' | 'Total Done' | 'Variety' | 'One-day';

/** The catalogue, in order: the one source of `BadgeId`. */
const CATALOGUE = [
  { id: 'streak-3', group: 'Streak', threshold: 3 },
  { id: 'streak-7', group: 'Streak', threshold: 7 },
  { id: 'streak-14', group: 'Streak', threshold: 14 },
  { id: 'streak-30', group: 'Streak', threshold: 30 },
  { id: 'streak-60', group: 'Streak', threshold: 60 },
  { id: 'streak-100', group: 'Streak', threshold: 100 },
  { id: 'done-1', group: 'Total Done', threshold: 1 },
  { id: 'done-10', group: 'Total Done', threshold: 10 },
  { id: 'done-50', group: 'Total Done', threshold: 50 },
  { id: 'done-100', group: 'Total Done', threshold: 100 },
  { id: 'done-250', group: 'Total Done', threshold: 250 },
  { id: 'done-500', group: 'Total Done', threshold: 500 },
  { id: 'variety-10', group: 'Variety', threshold: 10 },
  { id: 'variety-25', group: 'Variety', threshold: 25 },
  { id: 'variety-50', group: 'Variety', threshold: 50 },
  { id: 'balance', group: 'One-day' },
  { id: 'perfect-day', group: 'One-day' },
] as const satisfies readonly { id: string; group: BadgeGroup; threshold?: number }[];

/** A Badge of the catalogue (`BADGES`, which has them in order). */
export type BadgeId = (typeof CATALOGUE)[number]['id'];

/** One Badge of the catalogue. `threshold` is the count it unlocks at, where it has one. */
export interface Badge {
  id: BadgeId;
  group: BadgeGroup;
  threshold?: number;
}

/** The Badge catalogue, in order. Labels are the screen's job. */
export const BADGES: readonly Badge[] = CATALOGUE;

/** The personal bests, recomputed from the Activity Log. */
export interface Records {
  longestStreak: number;
  mostDoneInDay: number;
  mostDoneInWeek: number;
}

/**
 * The Records at `now`, all 0 on an empty Activity Log:
 * - `longestStreak`: the longest run of Goal Days under the Streak rules
 *   (`streak`): Days Off and days without Active Hours (by the current
 *   Settings) are skipped, and a today that isn't a Goal Day yet doesn't end
 *   a run. Never less than `streak(state, now)`.
 * - `mostDoneInDay`: the most Done Reminders in any one day (see `dayOf`).
 * - `mostDoneInWeek`: the most Done Reminders in any local Monday-Sunday week.
 *
 * Every day counts for the two most-Done Records, Days Off and days without
 * Active Hours included.
 */
export function records(state: CoreState, now: Instant): Records {
  const days = logByDay(state);
  const weeks = new Map<number, number>();
  let mostDoneInDay = 0;
  for (const day of days.values()) {
    mostDoneInDay = Math.max(mostDoneInDay, day.done);
    const week = dateKey(mondayOf(day.date));
    weeks.set(week, (weeks.get(week) ?? 0) + day.done);
  }
  return {
    longestStreak: longestStreak(state, days, now),
    mostDoneInDay,
    mostDoneInWeek: Math.max(0, ...weeks.values()),
  };
}

/**
 * Whether to show the new-Badge dot: some Badge unlocked after Achievements
 * was last opened (strictly after), or any Badge if it was never opened.
 */
export function hasNewBadge(state: CoreState): boolean {
  return state.badges.some((b) => isNewBadge(b, state.achievementsSeenAt));
}

/**
 * Whether a held Badge is New: unlocked strictly after `seenAt` (when
 * Achievements was last opened), or any Badge when it was never opened (`null`).
 */
export function isNewBadge(badge: UnlockedBadge, seenAt: Instant | null): boolean {
  return seenAt === null || badge.unlockedAt > seenAt;
}

/**
 * The Badges `state` meets at `now` and doesn't hold yet, in catalogue order.
 * `reduce` calls it after an accepted Done or Skip Response or Correct.
 * - Streak N: `longestStreak` (see `records`) is at least N.
 * - Total Done N: at least N Done Reminders in the Activity Log.
 * - Variety N: at least N distinct Exercise Ids across every `done` list.
 * - Balance: some day whose `done` lists cover all six Body Areas.
 * - Perfect day: some day (today so far included) whose Done count reaches
 *   that day's Daily Goal, with no skipped or Missed Reminder. Dropped and
 *   still-scheduled Reminders are ignored.
 */
export function badgesToUnlock(state: CoreState, now: Instant): BadgeId[] {
  const held = new Set(state.badges.map((b) => b.id));
  const days = logByDay(state);
  let totalDone = 0;
  const exercises = new Set<string>();
  for (const r of state.reminders) {
    if (r.status !== 'done') continue;
    totalDone += 1;
    for (const e of r.done ?? []) exercises.add(e.id);
  }
  const dayList = [...days.values()];
  const balance = dayList.some((day) => BODY_AREAS.every((area) => day.areas.has(area)));
  const perfectDay = dayList.some(
    (day) => day.done >= dailyGoalFor(state, day.date) && day.skipped === 0 && day.missed === 0,
  );
  const runs = longestStreak(state, days, now);

  const met = (badge: Badge): boolean => {
    switch (badge.group) {
      case 'Streak':
        return runs >= (badge.threshold ?? Infinity);
      case 'Total Done':
        return totalDone >= (badge.threshold ?? Infinity);
      case 'Variety':
        return exercises.size >= (badge.threshold ?? Infinity);
      case 'One-day':
        return badge.id === 'balance' ? balance : perfectDay;
    }
  };
  return BADGES.filter((badge) => !held.has(badge.id) && met(badge)).map((badge) => badge.id);
}

/** One day of the Activity Log: its Done, skipped and Missed counts and the Body Areas in its `done` lists. */
interface LoggedDay {
  date: LocalDate;
  done: number;
  skipped: number;
  missed: number;
  areas: Set<BodyArea>;
}

/** The Activity Log by day (`dayOf`), keyed by `dateKey`: one pass over the Reminders. */
function logByDay(state: CoreState): Map<number, LoggedDay> {
  const days = new Map<number, LoggedDay>();
  for (const r of state.reminders) {
    const date = dayOf(r, state.settings.timeZone);
    const key = dateKey(date);
    let day = days.get(key);
    if (!day) {
      day = { date, done: 0, skipped: 0, missed: 0, areas: new Set() };
      days.set(key, day);
    }
    if (r.status === 'done') {
      day.done += 1;
      for (const e of r.done ?? []) day.areas.add(e.bodyArea);
    } else if (r.status === 'skipped') day.skipped += 1;
    else if (r.status === 'missed') day.missed += 1;
  }
  return days;
}

/**
 * The longest run of Goal Days (`isGoalDay`, the hero `streak`'s rule) from the
 * earliest Reminder's day to today, under the Streak rules (see `records`).
 * `days` only gives the earliest day.
 */
function longestStreak(state: CoreState, days: Map<number, LoggedDay>, now: Instant): number {
  if (days.size === 0) return 0;
  const today = dateKey(localDateOf(now, state.settings.timeZone));
  let date = [...days.values()].reduce((a, b) => (dateKey(b.date) < dateKey(a.date) ? b : a)).date;
  let run = 0;
  let longest = 0;
  for (; dateKey(date) <= today; date = addDays(date, 1)) {
    if (!countsForStreak(state, date)) continue;
    if (isGoalDay(state, date)) longest = Math.max(longest, ++run);
    else if (dateKey(date) !== today) run = 0;
  }
  return longest;
}
