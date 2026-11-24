import type { BodyArea, Difficulty, Equipment, Exercise, ExerciseType, TargetMuscle } from '../../core';
import type { LibraryGroup, SourceCategory, SourceEquipment, SourceExercise } from './types';

/** Every curation group, in the order the build reads them. */
export const LIBRARY_GROUPS = ['base', 'floor', 'dumbbells', 'resistance-bands'] as const;

/** Whether a name (e.g. a curation file name or a CLI argument) is one of the groups. */
export function isLibraryGroup(name: string): name is LibraryGroup {
  return (LIBRARY_GROUPS as readonly string[]).includes(name);
}

/** The Equipment each group holds; `null` for the no-equipment groups. */
export const GROUP_EQUIPMENT: Record<LibraryGroup, Equipment | null> = {
  base: null,
  floor: null,
  dumbbells: 'dumbbells',
  'resistance-bands': 'resistance bands',
};

/** Body Area per Target Muscle: the six-area table of issue #7. */
export const BODY_AREA_BY_MUSCLE: Record<TargetMuscle, BodyArea> = {
  neck: 'Neck',
  shoulders: 'Shoulders & Upper Back',
  traps: 'Shoulders & Upper Back',
  'middle back': 'Shoulders & Upper Back',
  lats: 'Shoulders & Upper Back',
  chest: 'Chest & Arms',
  biceps: 'Chest & Arms',
  triceps: 'Chest & Arms',
  forearms: 'Wrists & Forearms',
  abdominals: 'Core & Lower Back',
  'lower back': 'Core & Lower Back',
  glutes: 'Hips & Legs',
  abductors: 'Hips & Legs',
  adductors: 'Hips & Legs',
  quadriceps: 'Hips & Legs',
  hamstrings: 'Hips & Legs',
  calves: 'Hips & Legs',
};

export const EXERCISE_TYPE_BY_CATEGORY: Record<SourceCategory, ExerciseType> = {
  stretching: 'Stretch',
  plyometrics: 'Plyometric',
  cardio: 'Cardio',
  strength: 'Strength',
  powerlifting: 'Strength',
  'olympic weightlifting': 'Strength',
  strongman: 'Strength',
};

export const DIFFICULTY_BY_LEVEL: Record<SourceExercise['level'], Difficulty> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  expert: 'Expert',
};

/**
 * App Equipment per source equipment: `null` is none, `undefined` is not v1
 * Equipment (never shipped): gym kit, and the kit that left v1 in #20.
 */
const SOURCE_EQUIPMENT: Record<SourceEquipment, Equipment | null | undefined> = {
  'body only': null,
  dumbbell: 'dumbbells',
  bands: 'resistance bands',
  kettlebells: undefined,
  'medicine ball': undefined,
  'exercise ball': undefined,
  'foam roll': undefined,
  machine: undefined,
  cable: undefined,
  barbell: undefined,
  'e-z curl bar': undefined,
  other: undefined,
};

/** The app Equipment for a source entry, or `undefined` when its equipment is not v1 Equipment. */
export function mapEquipment(source: SourceExercise): Equipment | null | undefined {
  return source.equipment === null ? null : SOURCE_EQUIPMENT[source.equipment];
}

/** Every photo key of the Exercises, start before end, in their order. */
export function photoKeys(exercises: readonly Exercise[]): string[] {
  return exercises.flatMap((e) => (e.photos ? [e.photos.start, e.photos.end] : []));
}

/** The bundled file of a photo key, relative to the photo folder: `Plank/0.jpg` → `Plank/0.webp`. */
export function photoFile(key: string): string {
  return key.replace(/\.jpg$/, '.webp');
}

/**
 * The photo keys `library:photos` still has to download and compress, in their
 * order: those whose bundled file is not there yet. A present `.webp` is never
 * redone, so a rerun downloads nothing.
 */
export function missingPhotos(keys: readonly string[], exists: (key: string) => boolean): string[] {
  return keys.filter((key) => !exists(key));
}

/** A stable sort key: plain code-unit order, the same on every machine. */
export function byId<T extends { id: string }>(a: T, b: T): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
