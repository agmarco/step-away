/**
 * Achievements: the Badge catalogue, the Records and the new-Badge dot (#28).
 * Badges are evaluated inside `reduce`; Records are recomputed on every call.
 */

import type { BadgeId, CoreState, Instant } from './types';

/** How the Achievements page groups the Badges. */
export type BadgeGroup = 'Streak' | 'Total Done' | 'Variety' | 'One-day';

/** One Badge of the catalogue. `threshold` is the count it unlocks at, where it has one. */
export interface Badge {
  id: BadgeId;
  group: BadgeGroup;
  threshold?: number;
}

/** The Badge catalogue, in order. Labels are the screen's job. */
export const BADGES: readonly Badge[] = [
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
];

/** The personal bests, recomputed from the Activity Log. */
export interface Records {
  longestStreak: number;
  mostDoneInDay: number;
  mostDoneInWeek: number;
}

/** The Records at `now`. #28 CP2. */
export function records(_state: CoreState, _now: Instant): Records {
  throw new Error('not implemented');
}

/** Whether some Badge unlocked after Achievements was last opened. #28 CP2. */
export function hasNewBadge(_state: CoreState): boolean {
  throw new Error('not implemented');
}
