import type { Equipment, Exercise } from './exercise';

/** The Exercise groups a library has at least one Exercise in. */
export interface ExerciseGroups {
  /** Whether any Exercise has Position Floor. */
  floor: boolean;
  /** The Equipment some Exercise needs, in `EQUIPMENT` order. */
  equipment: Equipment[];
}

/**
 * The groups of `library` that have at least one Exercise: the Settings page
 * shows the Floor toggle and an Equipment chip only for a group in it. An
 * Exercise that is both Floor and Equipment counts for both.
 */
export function exerciseGroups(_library: readonly Exercise[]): ExerciseGroups {
  throw new Error('exerciseGroups: not implemented (#29 CP2)');
}
