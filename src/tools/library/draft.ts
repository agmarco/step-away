import { stringify } from 'yaml';
import type { BodyArea, Difficulty, Equipment, ExerciseType } from '../../core';
import { BODY_AREA, byId, DIFFICULTY, EXERCISE_TYPE, GROUP_EQUIPMENT, mapEquipment } from './mapping';
import type { LibraryGroup, SourceExercise } from './types';

/** A candidate for a group, with the fields the script can fill from the source. */
export interface DraftEntry {
  id: string;
  name: string;
  exerciseType: ExerciseType;
  bodyArea: BodyArea;
  equipment: Equipment | null;
  /** Starting Difficulty, from the source `level`; the curator re-grades it. */
  difficulty: Difficulty;
}

export interface DraftInput {
  source: SourceExercise[];
  group: LibraryGroup;
  /** Ids already curated in any group; they are never candidates again. */
  curatedIds: ReadonlySet<string>;
}

/** Gym kit a desk break doesn't have, as whole words in the instructions. */
const GYM_KIT = /\b(bench(es)?|bars?|machines?|box(es)?|racks?)\b/i;

/** The candidate list for one group, sorted by Id. Pure. */
export function draftCandidates(input: DraftInput): DraftEntry[] {
  const { source, group, curatedIds } = input;
  const groupEquipment = GROUP_EQUIPMENT[group];

  return source
    .filter((s) => !curatedIds.has(s.id))
    .filter((s) => mapEquipment(s) === groupEquipment)
    .filter((s) => !s.instructions.some((line) => GYM_KIT.test(line)))
    .map(
      (s): DraftEntry => ({
        id: s.id,
        name: s.name,
        exerciseType: EXERCISE_TYPE[s.category],
        bodyArea: BODY_AREA[s.primaryMuscles[0]],
        equipment: groupEquipment,
        difficulty: DIFFICULTY[s.level],
      }),
    )
    .sort(byId);
}

/** The entries as YAML, a map keyed by Id. Pure. */
export function renderDraftYaml(entries: DraftEntry[]): string {
  const map = Object.fromEntries(entries.map(({ id, ...fields }) => [id, fields]));
  return stringify(map);
}
