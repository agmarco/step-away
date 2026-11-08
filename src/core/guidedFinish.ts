/**
 * What finishing the guided screen records. On the outstanding Reminder it is
 * the Done Response; once that Reminder is no longer outstanding (a newer one
 * fired, or it was answered from the shade meanwhile) a late answer is saved
 * as a correction of today's Reminder: a finished workout (at least one Did it
 * in the Suggestion) wins, even over a Skip; no Did its never overwrites a Done.
 */

import type { CoreEvent, CoreState, Instant } from './types';

/** The event a guided finish feeds into the core: a Done Response or a Correct. */
export type GuidedFinishEvent =
  | Extract<CoreEvent, { type: 'Response'; kind: 'Done' }>
  | Extract<CoreEvent, { type: 'Correct' }>;

/**
 * What finishing the guided screen on `reminderId` records, with `did` the Ids marked Did it
 * (empty for all Not this one, or End here before any Did it). null when nothing is recorded.
 */
export function guidedFinish(
  _state: CoreState,
  _reminderId: string,
  _did: readonly string[],
  _now: Instant,
): GuidedFinishEvent | null {
  throw new Error('not implemented');
}
