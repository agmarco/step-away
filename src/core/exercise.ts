/**
 * The Exercise as the app sees it: one entry of the bundled Exercise Library.
 * Types only. The library build step (tools/library) produces these from the
 * vendored free-exercise-db source plus the curation files. Attribute
 * definitions: issue #7.
 */

/** Where an Exercise comes from. */
export type ExerciseSource = 'free-exercise-db' | 'self-authored';

/** A Target Muscle: free-exercise-db's `primaryMuscles` vocabulary. */
export type TargetMuscle =
  | 'abdominals'
  | 'abductors'
  | 'adductors'
  | 'biceps'
  | 'calves'
  | 'chest'
  | 'forearms'
  | 'glutes'
  | 'hamstrings'
  | 'lats'
  | 'lower back'
  | 'middle back'
  | 'neck'
  | 'quadriceps'
  | 'shoulders'
  | 'traps'
  | 'triceps';

/** Exactly one of six, set by the main Target Muscle. */
export type BodyArea =
  | 'Neck'
  | 'Shoulders & Upper Back'
  | 'Chest & Arms'
  | 'Wrists & Forearms'
  | 'Core & Lower Back'
  | 'Hips & Legs';

export type ExerciseType = 'Strength' | 'Stretch' | 'Plyometric' | 'Cardio';

export type Difficulty = 'Beginner' | 'Intermediate' | 'Expert';

/** Position = Floor is what the Floor Exercises toggle filters on. */
export type Position = 'Seated' | 'Standing' | 'Either' | 'Floor';

/** Equipment an Exercise needs; `null` on Exercise means none. */
export type Equipment =
  | 'dumbbells'
  | 'kettlebell'
  | 'resistance bands'
  | 'medicine ball'
  | 'exercise ball'
  | 'foam roller';

/** A default Dose: reps or seconds, optionally Each Side. No sets. */
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
  /** Frozen forever: Dose overrides, Exclusions and the Activity Log key on it. */
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
  /** Optional for self-authored Exercises. */
  photos: ExercisePhotos | null;
  /** Optional source data, copied when present; not curated. */
  secondaryMuscles?: TargetMuscle[];
  force?: 'pull' | 'push' | 'static';
  mechanic?: 'compound' | 'isolation';
}
