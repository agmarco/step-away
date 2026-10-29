import { parse } from 'yaml';
import type {
  BodyArea,
  Difficulty,
  Dose,
  Equipment,
  Exercise,
  ExercisePhotos,
  ExerciseType,
  Position,
  TargetMuscle,
} from '../../core';
import { BODY_AREA, byId, DIFFICULTY, EXERCISE_TYPE, LIBRARY_GROUPS, mapEquipment } from './mapping';
import type { LibraryGroup, SourceExercise } from './types';

/** A fatal problem in the source or the curation files. The build stops. */
export class LibraryBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LibraryBuildError';
  }
}

export interface BuildInput {
  /** The parsed vendored `exercises.json`. */
  source: SourceExercise[];
  /** Curation YAML text per group, e.g. `{ base: '…', floor: '…' }`. */
  curation: Partial<Record<LibraryGroup, string>>;
  /** Whether a vendored photo exists, by photo key relative to the photo folder (e.g. `Plank/0.jpg`). */
  photoExists: (relPath: string) => boolean;
}

export interface BuildResult {
  /** Every curated Exercise, sorted by Id. */
  exercises: Exercise[];
  /**
   * Generated TypeScript module text. It sits beside the `photos/` folder and
   * maps each photo key to a static require, one line per photo, in Id order
   * (start before end):
   *
   *   'Plank/0.jpg': require('./photos/Plank/0.jpg'),
   */
  photoIndex: string;
  /** Non-fatal findings, e.g. a `sourceId` rename. */
  warnings: string[];
}

/** Ids of self-authored Exercises start with this. */
const CUSTOM_PREFIX = 'custom/';

const POSITIONS: readonly Position[] = ['Seated', 'Standing', 'Either', 'Floor'];
const DIFFICULTIES: readonly Difficulty[] = ['Beginner', 'Intermediate', 'Expert'];
const EXERCISE_TYPES: readonly ExerciseType[] = ['Strength', 'Stretch', 'Plyometric', 'Cardio'];
const BODY_AREAS: readonly BodyArea[] = [...new Set(Object.values(BODY_AREA))];
const EQUIPMENT: readonly Equipment[] = [
  'dumbbells',
  'kettlebell',
  'resistance bands',
  'medicine ball',
  'exercise ball',
  'foam roller',
];

type Entry = Record<string, unknown>;

/** One curation entry with where it came from, for error messages. */
interface Curated {
  id: string;
  group: LibraryGroup;
  entry: Entry;
}

/**
 * Merge the source and the curation files into the bundled Exercise Library.
 * Pure: no fs, no network. Throws LibraryBuildError on fatal problems.
 */
export function buildLibrary(input: BuildInput): BuildResult {
  const sourceById = new Map(input.source.map((s) => [s.id, s]));
  const warnings: string[] = [];

  const exercises = readCuration(input.curation)
    .map((curated) => {
      if (curated.id.startsWith(CUSTOM_PREFIX)) return selfAuthored(curated);
      const { exercise, warning } = sourceBacked(curated, sourceById);
      if (warning) warnings.push(warning);
      return exercise;
    })
    .sort(byId);

  const photoKeys = exercises.flatMap((e) => (e.photos ? [e.photos.start, e.photos.end] : []));
  for (const key of photoKeys) {
    if (!input.photoExists(key)) {
      throw new LibraryBuildError(`Missing photo ${key}: run \`npm run library:photos\`.`);
    }
  }

  return { exercises, photoIndex: renderPhotoIndex(photoKeys), warnings };
}

/** Every entry of every group, in canonical group order. Fails on an Id curated twice. */
function readCuration(curation: BuildInput['curation']): Curated[] {
  const groupOf = new Map<string, LibraryGroup>();
  const all: Curated[] = [];

  for (const group of LIBRARY_GROUPS) {
    const text = curation[group];
    if (text === undefined) continue;

    let parsed: unknown;
    try {
      parsed = parse(text);
    } catch (error) {
      throw new LibraryBuildError(`${group}.yaml is not valid YAML: ${(error as Error).message}`);
    }
    if (parsed === null || parsed === undefined) continue;
    if (!isMap(parsed)) throw new LibraryBuildError(`${group}.yaml must be a map keyed by Id.`);

    for (const [id, entry] of Object.entries(parsed)) {
      const earlier = groupOf.get(id);
      if (earlier) throw new LibraryBuildError(`${id} is curated in both ${earlier} and ${group}.`);
      groupOf.set(id, group);
      if (!isMap(entry)) throw new LibraryBuildError(`${id} (${group}): the entry must be a map of fields.`);
      all.push({ id, group, entry });
    }
  }
  return all;
}

function sourceBacked(
  curated: Curated,
  sourceById: Map<string, SourceExercise>,
): { exercise: Exercise; warning?: string } {
  const { id, group } = curated;
  const field = fieldReader(curated);

  const sourceId = field.optional('sourceId', isString);
  const source = sourceById.get(sourceId ?? id);
  if (!source) {
    throw new LibraryBuildError(
      sourceId === undefined
        ? `${id} (${group}) is not in the source exercises.json.`
        : `${id} (${group}): its sourceId ${sourceId} is not in the source exercises.json.`,
    );
  }

  const equipment = mapEquipment(source);
  if (equipment === undefined) {
    throw new LibraryBuildError(`${id} (${group}): source equipment "${source.equipment}" is ineligible.`);
  }

  const targetMuscles = field.optional('targetMuscles', isMuscleList) ?? source.primaryMuscles;
  const exercise: Exercise = {
    id,
    source: 'free-exercise-db',
    name: field.optional('name', isText) ?? source.name,
    targetMuscles,
    bodyArea: field.optional('bodyArea', isOneOf(BODY_AREAS)) ?? BODY_AREA[targetMuscles[0]],
    exerciseType: field.optional('exerciseType', isOneOf(EXERCISE_TYPES)) ?? EXERCISE_TYPE[source.category],
    difficulty: field.optional('difficulty', isOneOf(DIFFICULTIES)) ?? DIFFICULTY[source.level],
    position: field.required('position', isOneOf(POSITIONS)),
    equipment,
    energetic: field.required('energetic', isBoolean),
    dose: readDose(curated),
    cue: field.required('cue', isText),
    steps: field.required('steps', isTextList),
    photos: sourcePhotos(curated, source),
  };
  if (source.secondaryMuscles.length > 0) exercise.secondaryMuscles = source.secondaryMuscles;
  if (source.force !== null) exercise.force = source.force;
  if (source.mechanic !== null) exercise.mechanic = source.mechanic;

  const warning =
    sourceId === undefined
      ? undefined
      : `${id} (${group}) is built from sourceId ${sourceId}: free-exercise-db renamed it; the Id stays ${id}.`;
  return { exercise, warning };
}

function selfAuthored(curated: Curated): Exercise {
  const field = fieldReader(curated);
  return {
    id: curated.id,
    source: 'self-authored',
    name: field.required('name', isText),
    targetMuscles: field.required('targetMuscles', isMuscleList),
    bodyArea: field.required('bodyArea', isOneOf(BODY_AREAS)),
    exerciseType: field.required('exerciseType', isOneOf(EXERCISE_TYPES)),
    difficulty: field.required('difficulty', isOneOf(DIFFICULTIES)),
    position: field.required('position', isOneOf(POSITIONS)),
    equipment: field.required('equipment', (v): v is Equipment | null => v === null || isOneOf(EQUIPMENT)(v)),
    energetic: field.required('energetic', isBoolean),
    dose: readDose(curated),
    cue: field.required('cue', isText),
    steps: field.required('steps', isTextList),
    photos: null,
  };
}

function readDose({ id, group, entry }: Curated): Dose {
  const dose = entry.dose;
  const fail = (why: string): never => {
    throw new LibraryBuildError(`${id} (${group}): dose ${why}.`);
  };
  if (dose === undefined) return fail('is missing');
  if (!isMap(dose)) return fail('must be a map with reps or seconds');

  const { reps, seconds, eachSide = false, ...rest } = dose;
  const extra = Object.keys(rest);
  if (extra.length > 0) fail(`has unknown key ${extra.join(', ')}; use reps or seconds, and eachSide`);
  if ((reps === undefined) === (seconds === undefined)) fail('needs exactly one of reps or seconds');
  const amount = reps ?? seconds;
  if (!isPositiveInteger(amount)) fail(`amount must be a positive whole number, got ${String(amount)}`);
  if (typeof eachSide !== 'boolean') fail('eachSide must be true or false');

  return { kind: reps !== undefined ? 'reps' : 'seconds', amount: amount as number, eachSide: eachSide as boolean };
}

function sourcePhotos({ id, group }: Curated, source: SourceExercise): ExercisePhotos | null {
  if (source.images.length === 0) return null;
  if (source.images.length !== 2) {
    throw new LibraryBuildError(`${id} (${group}): source ${source.id} has ${source.images.length} images, expected 2.`);
  }
  return { start: source.images[0], end: source.images[1] };
}

function renderPhotoIndex(keys: string[]): string {
  const lines = keys.map((key) => `  '${key}': require('./photos/${key}'),\n`).join('');
  return [
    '// Generated by `npm run library:build`. Do not edit: change the curation files and rebuild.',
    '/* eslint-disable */',
    '',
    '/** Every bundled Exercise photo, by photo key (e.g. `Plank/0.jpg`). */',
    `const photos: Record<string, number> = {${keys.length ? `\n${lines}` : ''}};`,
    '',
    'export default photos;',
    '',
  ].join('\n');
}

/** Typed access to one entry's fields; errors name the Id, the group and the field. */
function fieldReader({ id, group, entry }: Curated) {
  const invalid = (key: string, value: unknown): never => {
    throw new LibraryBuildError(`${id} (${group}): invalid ${key}: ${JSON.stringify(value)}.`);
  };
  return {
    optional<T>(key: string, valid: (v: unknown) => v is T): T | undefined {
      const value = entry[key];
      if (value === undefined) return undefined;
      return valid(value) ? value : invalid(key, value);
    },
    required<T>(key: string, valid: (v: unknown) => v is T): T {
      const value = entry[key];
      if (value === undefined) throw new LibraryBuildError(`${id} (${group}): missing required field ${key}.`);
      return valid(value) ? value : invalid(key, value);
    },
  };
}

function isMap(value: unknown): value is Entry {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isString(value: unknown): value is string {
  return typeof value === 'string';
}
function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}
function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}
function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
function isTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isText);
}
function isMuscleList(value: unknown): value is TargetMuscle[] {
  return Array.isArray(value) && value.length > 0 && value.every(isString);
}
function isOneOf<T extends string>(allowed: readonly T[]) {
  return (value: unknown): value is T => typeof value === 'string' && (allowed as readonly string[]).includes(value);
}
