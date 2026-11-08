/**
 * What finishing the guided screen records. On the outstanding Reminder it is
 * the Done Response; once that Reminder is no longer outstanding (a newer one
 * fired, or it was answered from the shade meanwhile) a late answer is saved
 * as a correction of today's Reminder: a finished workout (at least one Did it
 * in the Suggestion) wins, even over a Skip; no Did its never overwrites a Done.
 */

import { dayOf, sameDate } from './days';
import { localDateOf } from './localTime';
import { outstandingReminder } from './schedule';
import { settle } from './settle';
import type { CoreEvent, CoreState, Instant, Reminder } from './types';

/** The event a guided finish feeds into the core: a Done Response or a Correct. */
export type GuidedFinishEvent =
  | Extract<CoreEvent, { type: 'Response'; kind: 'Done' }>
  | Extract<CoreEvent, { type: 'Correct' }>;

/**
 * What finishing the guided screen on `reminderId` records, with `did` the Ids marked Did it
 * (empty for all Not this one, or End here before any Did it). null when nothing is recorded.
 */
export function guidedFinish(
  state: CoreState,
  reminderId: string,
  did: readonly string[],
  now: Instant,
): GuidedFinishEvent | null {
  if (outstandingReminder(state, now)?.id === reminderId) {
    return { type: 'Response', reminderId, kind: 'Done', did: [...did] };
  }

  const target = settledToday(state, reminderId, now);
  if (!target) return null;

  const marked = new Set(did);
  if (target.suggestion.some(({ id }) => marked.has(id))) {
    // A finished workout wins, over any settled status.
    return { type: 'Correct', reminderId, to: 'Done', did: [...did] };
  }
  // No Did its never overwrites an answer; it only turns Missed or dropped into a Skip.
  if (target.status === 'done' || target.status === 'skipped') return null;
  return { type: 'Correct', reminderId, to: 'Skip' };
}

/**
 * The Reminder the guided screen can open on `reminderId` at `now`: the outstanding one, or one of
 * today's fired Reminders that settled as Missed or dropped (just replaced, or snoozed past closing).
 * undefined otherwise (answered, another day, not fired, unknown).
 */
export function guidedStart(state: CoreState, reminderId: string, now: Instant): Reminder | undefined {
  const outstanding = outstandingReminder(state, now);
  if (outstanding?.id === reminderId) return outstanding;
  const target = settledToday(state, reminderId, now);
  return target?.status === 'missed' || target?.status === 'dropped' ? target : undefined;
}

/**
 * Today's fired Reminder `reminderId` with its settled status (a replaced Reminder can still be
 * stored as `scheduled`), once it is no longer `scheduled`. undefined when it is unknown, not
 * fired, still scheduled once settled, or from another day.
 */
function settledToday(state: CoreState, reminderId: string, now: Instant): Reminder | undefined {
  const settled = settle(state, now);
  const target = settled.reminders.find((r) => r.id === reminderId);
  if (!target || target.firesAt > now || target.status === 'scheduled') return undefined;
  const { timeZone } = settled.settings;
  return sameDate(dayOf(target, timeZone), localDateOf(now, timeZone)) ? target : undefined;
}
