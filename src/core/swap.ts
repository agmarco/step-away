/**
 * Swap (#24): the replacement for one Exercise of a Suggestion, under the
 * Suggestion rules and the current settings.
 */

import type { Exercise } from './exercise';
import { eligiblePool, fallbackSetOf, pickByArea, snapshotOf, WINDOW, windowIds, without } from './suggest';
import type { Random, Reminder, Settings, SuggestedExercise } from './types';

/**
 * The Exercise that replaces `exerciseId` in `reminder`'s Suggestion, or
 * undefined when there is none. It comes from the pool (the fallback set, if
 * the Reminder is a fallback) and excludes the window of the Suggestions in
 * `earlier` (the Reminders before it, oldest first), this Suggestion and its
 * `swappedOut`. If nothing is left the window shrinks, down to 0, and then
 * the swapped-out Exercises come back in; never one already in the Suggestion.
 *
 * Order of preference: the same Body Area, then an area not elsewhere in the
 * Suggestion, then any area; areas first, all at weight 1.
 */
export function swapReplacement(
  reminder: Reminder,
  exerciseId: string,
  earlier: readonly Reminder[],
  settings: Settings,
  library: readonly Exercise[],
  random: Random,
): SuggestedExercise | undefined {
  const source = reminder.fallback ? fallbackSetOf(library) : eligiblePool(settings, library);
  const suggested = new Set(reminder.suggestion.map((e) => e.id));
  const notSuggested = without(source, suggested);
  const swappedOut = new Set(reminder.swappedOut ?? []);

  let candidates: Exercise[] = [];
  for (let size = WINDOW; size >= 0 && candidates.length === 0; size--) {
    candidates = without(without(notSuggested, swappedOut), windowIds(earlier, size));
  }
  if (candidates.length === 0) candidates = notSuggested;
  if (candidates.length === 0) return undefined;

  const swapped = reminder.suggestion.find((e) => e.id === exerciseId);
  const elsewhere = new Set(reminder.suggestion.filter((e) => e.id !== exerciseId).map((e) => e.bodyArea));
  const sameArea = candidates.filter((e) => e.bodyArea === swapped?.bodyArea);
  const newArea = candidates.filter((e) => !elsewhere.has(e.bodyArea));
  const tier = [sameArea, newArea, candidates].find((t) => t.length > 0) ?? candidates;
  return snapshotOf(pickByArea(tier, () => 1, random), settings);
}
