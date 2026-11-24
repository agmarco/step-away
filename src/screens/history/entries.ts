import type { Exercise, Reminder } from '../../core';

/** One Exercise of a History row: its Id, its name and, when it has one, its start photo's key. */
export type ShownExercise = { id: string; name: string; photo?: string };

/**
 * The Exercises a History row lists: a done Reminder's Done list, else its
 * Suggestion (never the Exercises swapped out of it). Each takes its current
 * name and start photo from `library` by Id; one no longer in the library
 * keeps the name snapshotted in the Reminder and has no photo.
 */
export function exercisesShown(reminder: Reminder, library: Exercise[]): ShownExercise[] {
  const snapshots = reminder.status === 'done' ? (reminder.done ?? []) : reminder.suggestion;
  return snapshots.map(({ id, name }) => {
    const entry = library.find((e) => e.id === id);
    if (!entry) return { id, name };
    return entry.photos ? { id, name: entry.name, photo: entry.photos.start } : { id, name: entry.name };
  });
}
