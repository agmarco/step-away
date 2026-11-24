import { dropReason, effectiveFire, refireScheduled, type CoreState, type DropReason, type Reminder } from '../../core';
import type { Palette } from '../../theme';
import { timeOf } from './format';

/** A dropped Reminder's status, by what dropped it. */
export const DROPPED_LABEL: Record<DropReason, string> = {
  pause: 'Ended by Pause',
  dayOff: 'Ended: Day Off',
  closing: 'Snoozed past closing',
};

/**
 * One fired Reminder's status line and its colour, from its settled status,
 * on Today's list and History's day panel. `outstandingId` is the outstanding
 * Reminder's Id, if any (only ever today's). A done Reminder reads "Done:
 * names" unless `plainDone` (History, which lists its Exercises under it),
 * then just "Done".
 */
export function statusOf(
  r: Reminder,
  state: CoreState,
  outstandingId: string | undefined,
  now: number,
  colors: Palette,
  { plainDone = false }: { plainDone?: boolean } = {},
) {
  switch (r.status) {
    case 'done':
      return {
        label: !plainDone && r.done?.length ? `Done: ${r.done.map((e) => e.name).join(', ')}` : 'Done',
        color: colors.outcome.done,
      };
    case 'skipped':
      return { label: 'Skipped', color: colors.outcome.skip };
    case 'missed':
      return { label: 'Missed', color: colors.outcome.missed };
    // Dropped is not an Activity Log outcome (not Missed), so it takes no outcome colour.
    case 'dropped':
      return { label: DROPPED_LABEL[dropReason(r)], color: colors.text.secondary };
    case 'scheduled':
      if (refireScheduled(r, state.settings, now)) {
        return { label: `Snoozed, back at ${timeOf(effectiveFire(r))}`, color: colors.text.secondary };
      }
      // Its re-fire lands past closing: never scheduled, dropped once the window ends.
      if (r.refiresAt !== undefined && r.refiresAt > now) {
        return { label: 'Snoozed past closing', color: colors.text.secondary };
      }
      if (r.id === outstandingId) return { label: 'Waiting for you', color: colors.accent.hero };
      // Not reachable once settled; kept so the screen never shows nothing.
      return { label: 'No Response', color: colors.text.secondary };
  }
}
