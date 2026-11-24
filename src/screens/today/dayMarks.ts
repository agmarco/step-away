import type { DayMark } from '../../core';
import type { Palette } from '../../theme';

/** How a day's mark reads aloud, in the week panel and the History calendar. */
export const MARK_LABEL: Record<DayMark, string> = {
  goal: 'Goal Day',
  missed: 'goal missed',
  off: 'no Active Hours',
  today: 'today',
  future: 'still ahead',
  dayOff: 'Day Off',
  none: 'no data yet',
};

/**
 * A day cell's look by mark, in the week panel and the History calendar:
 * Goal Day, missed and a Day Off are filled; a day without Active Hours is
 * muted; today has a ring; a day still ahead is outlined; a day before any
 * data (`none`) is blank, with no fill and no outline.
 *
 * Key the cell by its mark (`key={mark}`): on Android, a border added to a
 * mounted view that had `borderRadius` but no border draws with square
 * corners, so a cell that turns `future` or `today` must be a fresh view.
 */
export function markStyle(mark: DayMark, colors: Palette) {
  switch (mark) {
    case 'goal':
      return { backgroundColor: colors.day.goalDay };
    case 'missed':
      return { backgroundColor: colors.outcome.missed };
    case 'off':
      return { backgroundColor: colors.line.divider };
    case 'dayOff':
      return { backgroundColor: colors.day.dayOff };
    case 'today':
      return { backgroundColor: colors.background.card, borderWidth: 2, borderColor: colors.accent.hero };
    case 'future':
      return { backgroundColor: colors.background.card, borderWidth: 1, borderColor: colors.line.divider };
    case 'none':
      return {};
  }
}
