import type { Exercise } from './exercise';
import type { Random, SuggestedExercise } from './types';

/**
 * A Suggestion for one Reminder: `count` distinct Exercises picked with the
 * injected Random (all of them if the library has fewer), as text snapshots.
 * The library must not be empty. Temporary (dev only): #24 brings the real
 * Suggestion rules.
 */
export function suggest(library: readonly Exercise[], count: number, random: Random): SuggestedExercise[] {
  // A partial Fisher-Yates shuffle: the first pick is the same as a single pick.
  const pool = [...library];
  const picked: SuggestedExercise[] = [];
  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const j = i + Math.floor(random.next() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
    const { id, name, dose, cue, bodyArea } = pool[i];
    picked.push({ id, name, dose, cue, bodyArea });
  }
  return picked;
}
