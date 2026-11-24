import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { BodyArea, ExerciseType, TargetMuscle } from '../../core';
import { draftCandidates, renderDraftYaml, type DraftEntry } from './draft';
import type { LibraryGroup, SourceCategory, SourceEquipment, SourceExercise } from './types';

/** A clean, no-equipment source entry; override what the test is about. */
const entry = (id: string, overrides: Partial<SourceExercise> = {}): SourceExercise => ({
  id,
  name: id.replace(/_/g, ' '),
  force: 'static',
  level: 'beginner',
  mechanic: 'isolation',
  equipment: 'body only',
  primaryMuscles: ['quadriceps'],
  secondaryMuscles: [],
  instructions: ['Stand tall.', 'Move slowly and with control.'],
  category: 'stretching',
  images: [`${id}/0.jpg`, `${id}/1.jpg`],
  ...overrides,
});

const ids = (entries: DraftEntry[]) => entries.map((e) => e.id);
const none = new Set<string>();

const ALL_GROUPS: LibraryGroup[] = ['base', 'floor', 'dumbbells', 'resistance-bands'];

describe('draftCandidates: which entries are candidates', () => {
  const source: SourceExercise[] = [
    entry('Standing_Stretch'),
    entry('Null_Equipment_Stretch', { equipment: null }),
    entry('Bench_Move', { instructions: ['Sit on a bench.'] }),
    entry('Bar_Hang', { instructions: ['Grab the pull-up Bar overhead.'] }),
    entry('Machine_Move', { instructions: ['Stand beside the MACHINE.'] }),
    entry('Box_Step', { instructions: ['Step onto the box.'] }),
    entry('Rack_Move', { instructions: ['Hold the rack for balance.'] }),
    entry('Barbell_Free_Squat', { instructions: ['Squat as if holding a barbell across your back.'] }),
    entry('Already_Curated'),
    entry('Dumbbell_Curl', { equipment: 'dumbbell' }),
    entry('Dumbbell_Bench_Press', { equipment: 'dumbbell', instructions: ['Lie back on a flat bench.'] }),
  ];
  const curatedIds = new Set(['Already_Curated']);

  it('offers base no-equipment entries whose instructions mention no bench, bar, machine, box or rack', () => {
    expect(ids(draftCandidates({ source, group: 'base', curatedIds }))).toEqual([
      'Barbell_Free_Squat',
      'Null_Equipment_Stretch',
      'Standing_Stretch',
    ]);
  });

  it('offers floor the same no-equipment candidates as base', () => {
    expect(ids(draftCandidates({ source, group: 'floor', curatedIds }))).toEqual([
      'Barbell_Free_Squat',
      'Null_Equipment_Stretch',
      'Standing_Stretch',
    ]);
  });

  it('offers an Equipment group only entries with that Equipment, with the same instruction filter', () => {
    expect(ids(draftCandidates({ source, group: 'dumbbells', curatedIds }))).toEqual(['Dumbbell_Curl']);
  });

  it('never offers an Id already curated in any group', () => {
    const curatedElsewhere = new Set(['Already_Curated', 'Standing_Stretch', 'Dumbbell_Curl']);

    expect(ids(draftCandidates({ source, group: 'base', curatedIds: curatedElsewhere }))).toEqual([
      'Barbell_Free_Squat',
      'Null_Equipment_Stretch',
    ]);
    expect(draftCandidates({ source, group: 'dumbbells', curatedIds: curatedElsewhere })).toEqual([]);
  });

  it.each<[LibraryGroup, SourceEquipment]>([
    ['dumbbells', 'dumbbell'],
    ['resistance-bands', 'bands'],
  ])('offers the %s group the source "%s" entries', (group, equipment) => {
    const everyKind: SourceExercise[] = (
      ['body only', 'dumbbell', 'kettlebells', 'bands', 'medicine ball', 'exercise ball', 'foam roll'] as const
    ).map((kind) => entry(`Move_With_${kind.replace(/ /g, '_')}`, { equipment: kind }));

    expect(ids(draftCandidates({ source: everyKind, group, curatedIds: none }))).toEqual([
      `Move_With_${equipment.replace(/ /g, '_')}`,
    ]);
  });

  it.each<[string, SourceEquipment[]]>([
    ['kettlebells, medicine ball, exercise ball or foam roll', ['kettlebells', 'medicine ball', 'exercise ball', 'foam roll']],
    ['machine, cable, barbell, e-z curl bar or other', ['machine', 'cable', 'barbell', 'e-z curl bar', 'other']],
  ])('never offers %s, which are not v1 Equipment, in any group', (_, kinds) => {
    const notV1: SourceExercise[] = kinds.map((kind) => entry(`Move_With_${kind.replace(/[ -]/g, '_')}`, { equipment: kind }));

    for (const group of ALL_GROUPS) {
      expect(draftCandidates({ source: notV1, group, curatedIds: none }), group).toEqual([]);
    }
  });
});

describe('draftCandidates: script-filled fields', () => {
  it('fills Exercise Type, Body Area, Equipment and starting Difficulty from the source', () => {
    const source = [
      entry('Star_Jump', {
        name: 'Star Jump',
        category: 'plyometrics',
        level: 'intermediate',
        primaryMuscles: ['quadriceps'],
        equipment: 'body only',
      }),
      entry('Hammer_Curls', {
        name: 'Hammer Curls',
        category: 'strength',
        level: 'expert',
        primaryMuscles: ['biceps', 'forearms'],
        equipment: 'dumbbell',
      }),
    ];

    expect(draftCandidates({ source, group: 'base', curatedIds: none })).toEqual([
      {
        id: 'Star_Jump',
        name: 'Star Jump',
        exerciseType: 'Plyometric',
        bodyArea: 'Hips & Legs',
        equipment: null,
        difficulty: 'Intermediate',
      },
    ]);
    expect(draftCandidates({ source, group: 'dumbbells', curatedIds: none })).toEqual([
      {
        id: 'Hammer_Curls',
        name: 'Hammer Curls',
        exerciseType: 'Strength',
        bodyArea: 'Chest & Arms', // first primary muscle wins
        equipment: 'dumbbells',
        difficulty: 'Expert',
      },
    ]);
  });

  it.each<[SourceCategory, ExerciseType]>([
    ['stretching', 'Stretch'],
    ['plyometrics', 'Plyometric'],
    ['cardio', 'Cardio'],
    ['strength', 'Strength'],
    ['powerlifting', 'Strength'],
    ['olympic weightlifting', 'Strength'],
    ['strongman', 'Strength'],
  ])('maps category %s to Exercise Type %s', (category, exerciseType) => {
    const [drafted] = draftCandidates({ source: [entry('Move', { category })], group: 'base', curatedIds: none });

    expect(drafted.exerciseType).toBe(exerciseType);
  });

  it.each<[TargetMuscle, BodyArea]>([
    ['neck', 'Neck'],
    ['shoulders', 'Shoulders & Upper Back'],
    ['traps', 'Shoulders & Upper Back'],
    ['middle back', 'Shoulders & Upper Back'],
    ['lats', 'Shoulders & Upper Back'],
    ['chest', 'Chest & Arms'],
    ['biceps', 'Chest & Arms'],
    ['triceps', 'Chest & Arms'],
    ['forearms', 'Wrists & Forearms'],
    ['abdominals', 'Core & Lower Back'],
    ['lower back', 'Core & Lower Back'],
    ['glutes', 'Hips & Legs'],
    ['abductors', 'Hips & Legs'],
    ['adductors', 'Hips & Legs'],
    ['quadriceps', 'Hips & Legs'],
    ['hamstrings', 'Hips & Legs'],
    ['calves', 'Hips & Legs'],
  ])('maps a first primary muscle of %s to Body Area %s', (muscle, bodyArea) => {
    const [drafted] = draftCandidates({
      source: [entry('Move', { primaryMuscles: [muscle] })],
      group: 'base',
      curatedIds: none,
    });

    expect(drafted.bodyArea).toBe(bodyArea);
  });
});

describe('renderDraftYaml', () => {
  it('renders the entries as YAML keyed by Id that parses back to the same entries', () => {
    const entries: DraftEntry[] = [
      {
        id: 'Chin-Up',
        name: 'Chin-Up: Close Grip',
        exerciseType: 'Strength',
        bodyArea: 'Shoulders & Upper Back',
        equipment: null,
        difficulty: 'Beginner',
      },
      {
        id: 'Band_Pull_Apart',
        name: 'Band Pull Apart',
        exerciseType: 'Strength',
        bodyArea: 'Shoulders & Upper Back',
        equipment: 'resistance bands',
        difficulty: 'Intermediate',
      },
    ];

    expect(parse(renderDraftYaml(entries))).toEqual({
      'Chin-Up': {
        name: 'Chin-Up: Close Grip',
        exerciseType: 'Strength',
        bodyArea: 'Shoulders & Upper Back',
        equipment: null,
        difficulty: 'Beginner',
      },
      Band_Pull_Apart: {
        name: 'Band Pull Apart',
        exerciseType: 'Strength',
        bodyArea: 'Shoulders & Upper Back',
        equipment: 'resistance bands',
        difficulty: 'Intermediate',
      },
    });
  });

  it('renders no entries as an empty map', () => {
    expect(parse(renderDraftYaml([])) ?? {}).toEqual({});
  });
});

describe('draftCandidates: the instruction filter matches whole words', () => {
  const candidates = (instructions: string[]) =>
    ids(draftCandidates({ source: [entry('Move', { instructions })], group: 'base', curatedIds: none }));

  it('drops an entry that mentions bars, in the plural', () => {
    expect(candidates(['Hold the parallel bars and lift yourself up.'])).toEqual([]);
  });

  it.each(['Sit between two Benches.', 'Use the machines.', 'Step between the boxes.', 'Hold the RACKS.'])(
    'drops an entry that mentions gym kit in the plural: %s',
    (line) => {
      expect(candidates([line])).toEqual([]);
    },
  );

  it('keeps an entry that mentions track, which is not rack', () => {
    expect(candidates(['Keep your knees on track over your toes.'])).toEqual(['Move']);
  });

  it('keeps an entry that mentions tracking or a barbell, which are not rack or bar', () => {
    expect(candidates(['Keep tracking your breath.', 'Hold your arms as if gripping a barbell.'])).toEqual(['Move']);
  });
});
