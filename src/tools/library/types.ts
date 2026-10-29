import type { Force, Mechanic, TargetMuscle } from '../../core';
import type { LIBRARY_GROUPS } from './mapping';

/**
 * One entry of free-exercise-db's `dist/exercises.json`, exactly as vendored.
 * The vocabularies below were verified on commit f00c92c7.
 */
export interface SourceExercise {
  id: string;
  name: string;
  force: Force | null;
  level: 'beginner' | 'intermediate' | 'expert';
  mechanic: Mechanic | null;
  equipment: SourceEquipment | null;
  primaryMuscles: TargetMuscle[];
  secondaryMuscles: TargetMuscle[];
  instructions: string[];
  category: SourceCategory;
  /** `["<id>/0.jpg", "<id>/1.jpg"]`, or `[]` for a few entries. */
  images: string[];
}

export type SourceCategory =
  | 'strength'
  | 'stretching'
  | 'plyometrics'
  | 'strongman'
  | 'powerlifting'
  | 'cardio'
  | 'olympic weightlifting';

export type SourceEquipment =
  | 'body only'
  | 'machine'
  | 'other'
  | 'foam roll'
  | 'kettlebells'
  | 'dumbbell'
  | 'cable'
  | 'barbell'
  | 'bands'
  | 'medicine ball'
  | 'exercise ball'
  | 'e-z curl bar';

/** A curation group: one YAML file each (`<group>.yaml`). */
export type LibraryGroup = (typeof LIBRARY_GROUPS)[number];
