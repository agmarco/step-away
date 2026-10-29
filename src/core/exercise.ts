/**
 * The Exercise as the app sees it: one entry of the bundled Exercise Library.
 * Types and their value lists only. The library build step (tools/library)
 * produces these from the vendored free-exercise-db source plus the curation
 * files. Attribute definitions: issue #7.
 */

/** Where an Exercise comes from. */
export type ExerciseSource = 'free-exercise-db' | 'self-authored';

/** The Target Muscles: free-exercise-db's `primaryMuscles` vocabulary. */
export const TARGET_MUSCLES = [
  'abdominals',
  'abductors',
  'adductors',
  'biceps',
  'calves',
  'chest',
  'forearms',
  'glutes',
  'hamstrings',
  'lats',
  'lower back',
  'middle back',
  'neck',
  'quadriceps',
  'shoulders',
  'traps',
  'triceps',
] as const;
export type TargetMuscle = (typeof TARGET_MUSCLES)[number];

/** The six Body Areas; an Exercise has exactly one, set by the main Target Muscle. */
export const BODY_AREAS = [
  'Neck',
  'Shoulders & Upper Back',
  'Chest & Arms',
  'Wrists & Forearms',
  'Core & Lower Back',
  'Hips & Legs',
] as const;
export type BodyArea = (typeof BODY_AREAS)[number];

export const EXERCISE_TYPES = ['Strength', 'Stretch', 'Plyometric', 'Cardio'] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export const DIFFICULTIES = ['Beginner', 'Intermediate', 'Expert'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Position = Floor is what the Floor Exercises toggle filters on. */
export const POSITIONS = ['Seated', 'Standing', 'Either', 'Floor'] as const;
export type Position = (typeof POSITIONS)[number];

/** Equipment an Exercise needs; `null` on Exercise means none. */
export const EQUIPMENT = [
  'dumbbells',
  'kettlebell',
  'resistance bands',
  'medicine ball',
  'exercise ball',
  'foam roller',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

/** The source `force` of an Exercise, copied when present. */
export type Force = 'pull' | 'push' | 'static';

/** The source `mechanic` of an Exercise, copied when present. */
export type Mechanic = 'compound' | 'isolation';

/** A default Dose: reps or seconds, optionally each side. No sets. */
export interface Dose {
  kind: 'reps' | 'seconds';
  amount: number;
  eachSide: boolean;
}

/** Start/end photo keys, relative to the library's photo folder (e.g. `Side_Neck_Stretch/0.jpg`). */
export interface ExercisePhotos {
  start: string;
  end: string;
}

export interface Exercise {
  /** Frozen forever: Dose overrides, Excluded Exercises and the Activity Log key on it. */
  id: string;
  source: ExerciseSource;
  name: string;
  targetMuscles: TargetMuscle[];
  bodyArea: BodyArea;
  exerciseType: ExerciseType;
  difficulty: Difficulty;
  position: Position;
  equipment: Equipment | null;
  energetic: boolean;
  dose: Dose;
  /** One glanceable line. */
  cue: string;
  steps: string[];
  /** Always `null` for self-authored Exercises for now. */
  photos: ExercisePhotos | null;
  /** Optional source data, copied when present; not curated. */
  secondaryMuscles?: TargetMuscle[];
  force?: Force;
  mechanic?: Mechanic;
}
