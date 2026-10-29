import type { BodyArea, Difficulty, Equipment, ExerciseType, TargetMuscle } from '../../core';
import type { LibraryGroup, SourceCategory, SourceEquipment, SourceExercise } from './types';

/** Every curation group, in the order the build reads them. */
export const LIBRARY_GROUPS: readonly LibraryGroup[] = [
  'base',
  'floor',
  'dumbbells',
  'kettlebell',
  'resistance-bands',
  'medicine-ball',
  'exercise-ball',
  'foam-roller',
];

/** The Equipment each group holds; `null` for the no-equipment groups. */
export const GROUP_EQUIPMENT: Record<LibraryGroup, Equipment | null> = {
  base: null,
  floor: null,
  dumbbells: 'dumbbells',
  kettlebell: 'kettlebell',
  'resistance-bands': 'resistance bands',
  'medicine-ball': 'medicine ball',
  'exercise-ball': 'exercise ball',
  'foam-roller': 'foam roller',
};

/** Body Area per Target Muscle: the six-area table of issue #7. */
export const BODY_AREA: Record<TargetMuscle, BodyArea> = {
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

export const EXERCISE_TYPE: Record<SourceCategory, ExerciseType> = {
  stretching: 'Stretch',
  plyometrics: 'Plyometric',
  cardio: 'Cardio',
  strength: 'Strength',
  powerlifting: 'Strength',
  'olympic weightlifting': 'Strength',
  strongman: 'Strength',
};

export const DIFFICULTY: Record<SourceExercise['level'], Difficulty> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  expert: 'Expert',
};

/** App Equipment per source equipment: `null` is none, `undefined` is ineligible (never shipped). */
const SOURCE_EQUIPMENT: Record<SourceEquipment, Equipment | null | undefined> = {
  'body only': null,
  dumbbell: 'dumbbells',
  kettlebells: 'kettlebell',
  bands: 'resistance bands',
  'medicine ball': 'medicine ball',
  'exercise ball': 'exercise ball',
  'foam roll': 'foam roller',
  machine: undefined,
  cable: undefined,
  barbell: undefined,
  'e-z curl bar': undefined,
  other: undefined,
};

/** The app Equipment for a source entry, or `undefined` when its equipment is ineligible. */
export function mapEquipment(source: SourceExercise): Equipment | null | undefined {
  return source.equipment === null ? null : SOURCE_EQUIPMENT[source.equipment];
}

/** A stable sort key: plain code-unit order, the same on every machine. */
export function byId<T extends { id: string }>(a: T, b: T): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
