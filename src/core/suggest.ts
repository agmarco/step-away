import type { Exercise } from './exercise';
import type { Random, SuggestedExercise } from './types';

/**
 * A Suggestion for one Reminder: exactly 1 Exercise picked with the injected
 * Random, as a text snapshot. The library must not be empty.
 */
export function suggest(library: readonly Exercise[], random: Random): SuggestedExercise[] {
  const { id, name, dose, cue, bodyArea } = library[Math.floor(random.next() * library.length)];
  return [{ id, name, dose, cue, bodyArea }];
}
