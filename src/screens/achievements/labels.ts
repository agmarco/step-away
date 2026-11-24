/**
 * The Achievements page's words (#28), following the prototype
 * (`prototypes/app-navigation`, `BADGES` and `RECORDS` in data.ts): the Badge
 * and group labels, the Records row, and the Badges by group with which are
 * unlocked and which are New. Pure; the page and the celebration card render it.
 */
import { BADGES, isNewBadge, type BadgeGroup, type BadgeId, type CoreState, type Instant, type Records } from '../../core';

const GROUP_LABELS: Record<BadgeGroup, string> = {
  Streak: 'Streak',
  'Total Done': 'Total Done',
  Variety: 'Variety',
  'One-day': 'One-day',
};

const NAMED: Partial<Record<BadgeId, string>> = { balance: 'Balance', 'perfect-day': 'Perfect day' };

export function groupLabel(group: BadgeGroup): string {
  return GROUP_LABELS[group];
}

/** A Badge's label within its group: "3 days" (Streak), "10" (Total Done), "25 Exercises" (Variety), "Balance". */
export function badgeLabel(id: BadgeId): string {
  const named = NAMED[id];
  if (named) return named;
  const badge = BADGES.find((b) => b.id === id);
  const n = badge?.threshold ?? 0;
  switch (badge?.group) {
    case 'Streak':
      return `${n} days`;
    case 'Variety':
      return `${n} Exercises`;
    default:
      return String(n);
  }
}

/** A Badge on its own, for the celebration card: the group first where the label alone wouldn't say what it is. */
export function celebrationLine(id: BadgeId): string {
  const badge = BADGES.find((b) => b.id === id);
  if (!badge || badge.group === 'One-day') return badgeLabel(id);
  return `${groupLabel(badge.group)}: ${badgeLabel(id)}`;
}

/** The Records row, in the prototype's order. */
export function recordTiles(records: Records): { label: string; value: string }[] {
  const { longestStreak, mostDoneInDay, mostDoneInWeek } = records;
  return [
    { label: 'Longest Streak', value: `${longestStreak} ${longestStreak === 1 ? 'day' : 'days'}` },
    { label: 'Most Done in a day', value: String(mostDoneInDay) },
    { label: 'Most Done in a week', value: String(mostDoneInWeek) },
  ];
}

/** One Badge on the page. `isNew`: unlocked after the previous visit. */
export interface BadgeTile {
  id: BadgeId;
  label: string;
  unlocked: boolean;
  isNew: boolean;
}

export interface BadgeSection {
  group: BadgeGroup;
  label: string;
  badges: BadgeTile[];
}

/**
 * Every Badge of the catalogue, by group in `BADGES` order, with whether it is
 * held and whether it is New: unlocked strictly after `seenAt` (the previous
 * visit), or any held Badge when Achievements was never opened (`null`), the
 * core's `isNewBadge`.
 */
export function badgeSections(held: CoreState['badges'], seenAt: Instant | null): BadgeSection[] {
  const heldById = new Map(held.map((b) => [b.id, b]));
  const sections: BadgeSection[] = [];
  for (const badge of BADGES) {
    let section = sections.find((s) => s.group === badge.group);
    if (!section) {
      section = { group: badge.group, label: groupLabel(badge.group), badges: [] };
      sections.push(section);
    }
    const unlocked = heldById.get(badge.id);
    section.badges.push({
      id: badge.id,
      label: badgeLabel(badge.id),
      unlocked: unlocked !== undefined,
      isNew: unlocked !== undefined && isNewBadge(unlocked, seenAt),
    });
  }
  return sections;
}
