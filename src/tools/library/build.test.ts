import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Exercise } from '../../core';
import { buildLibrary, LibraryBuildError, type BuildInput } from './build';
import type { LibraryGroup, SourceExercise } from './types';

const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8');

const source: SourceExercise[] = JSON.parse(fixture('source.json'));
const curation = {
  base: fixture('curation/base.yaml'),
  floor: fixture('curation/floor.yaml'),
  dumbbells: fixture('curation/dumbbells.yaml'),
  'resistance-bands': fixture('curation/resistance-bands.yaml'),
} satisfies Partial<Record<LibraryGroup, string>>;
const allPhotosPresent = () => true;

const build = (overrides: Partial<BuildInput> = {}) =>
  buildLibrary({ source, curation, photoExists: allPhotosPresent, ...overrides });

const byId = (exercises: Exercise[], id: string) => {
  const found = exercises.find((e) => e.id === id);
  if (!found) throw new Error(`no Exercise ${id} in the build`);
  return found;
};

/** Asserts that `run` throws a LibraryBuildError whose message contains every fragment. */
function expectBuildError(run: () => unknown, ...fragments: string[]) {
  let thrown: unknown;
  try {
    run();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(LibraryBuildError);
  for (const fragment of fragments) expect((thrown as Error).message).toContain(fragment);
}

/** A minimal valid source-backed curation entry, as YAML. */
const entryYaml = (id: string, extra = '') => `
${id}:
  position: Standing
  energetic: false
  difficulty: Beginner
  dose:
    reps: 10
  cue: A cue
  steps:
    - A step.${extra}
`;

describe('buildLibrary: merge', () => {
  it('builds a source-backed Exercise with every attribute, falling back to the source mapping', () => {
    const { exercises } = build();

    expect(byId(exercises, 'Side_Neck_Stretch')).toEqual({
      id: 'Side_Neck_Stretch',
      source: 'free-exercise-db',
      name: 'Side Neck Stretch',
      targetMuscles: ['neck'],
      bodyArea: 'Neck',
      exerciseType: 'Stretch',
      difficulty: 'Beginner',
      position: 'Either',
      equipment: null,
      energetic: false,
      dose: { kind: 'seconds', amount: 30, eachSide: true },
      cue: 'Drop ear to shoulder, keep shoulders down',
      steps: [
        'Sit or stand tall with your shoulders relaxed.',
        'Gently tilt your head towards one shoulder.',
        'Assist with a light pull on the side of your head.',
      ],
      photos: { start: 'Side_Neck_Stretch/0.jpg', end: 'Side_Neck_Stretch/1.jpg' },
      force: 'static',
      mechanic: 'isolation',
    });
  });

  it('lets a curated Name win over the source and copies the optional source fields', () => {
    const squat = byId(build().exercises, 'Bodyweight_Squat');

    expect(squat.name).toBe('Desk Squat');
    expect(squat.targetMuscles).toEqual(['quadriceps']);
    expect(squat.bodyArea).toBe('Hips & Legs');
    expect(squat.exerciseType).toBe('Strength');
    expect(squat.equipment).toBeNull(); // source "body only"
    expect(squat.dose).toEqual({ kind: 'reps', amount: 10, eachSide: false });
    expect(squat.secondaryMuscles).toEqual(['glutes', 'hamstrings']);
    expect(squat.force).toBe('push');
    expect(squat.mechanic).toBe('compound');
  });

  it('takes Steps from the curation file, not the source instructions', () => {
    expect(byId(build().exercises, 'Bodyweight_Squat').steps).toEqual([
      'Stand with your feet shoulder width apart.',
      'Sit back and down until your thighs are parallel to the floor.',
      'Drive through your heels to stand.',
    ]);
  });

  it('lets a curated Exercise Type and Difficulty win over the source category and level', () => {
    const jump = byId(build().exercises, 'Star_Jump');

    expect(jump.exerciseType).toBe('Cardio'); // source: plyometrics
    expect(jump.difficulty).toBe('Beginner'); // source: intermediate
    expect(jump.energetic).toBe(true);
    expect(jump.force).toBeUndefined(); // source force is null
  });

  it('lets curated Target Muscles and Body Area win over the source primaryMuscles', () => {
    const stretch = byId(build().exercises, 'Chair_Upper_Body_Stretch');

    expect(stretch.targetMuscles).toEqual(['chest', 'shoulders']);
    expect(stretch.bodyArea).toBe('Chest & Arms'); // source first muscle: shoulders
    expect(stretch.position).toBe('Seated');
    expect(stretch.mechanic).toBeUndefined(); // source mechanic is null
  });

  it('maps source Equipment to the app Equipment', () => {
    const { exercises } = build();

    expect(byId(exercises, 'Hammer_Curls').equipment).toBe('dumbbells');
    expect(byId(exercises, 'Band_Pull_Apart').equipment).toBe('resistance bands');
  });

  it('falls back to the source level for Difficulty and has no photos when the source has no images', () => {
    const pullApart = byId(build().exercises, 'Band_Pull_Apart');

    expect(pullApart.difficulty).toBe('Intermediate');
    expect(pullApart.bodyArea).toBe('Shoulders & Upper Back');
    expect(pullApart.dose).toEqual({ kind: 'reps', amount: 5, eachSide: true });
    expect(pullApart.photos).toBeNull();
  });

  it('builds without warnings when nothing is renamed', () => {
    expect(build().warnings).toEqual([]);
  });
});

describe('buildLibrary: curated only', () => {
  it('ships exactly the curated Exercises, sorted by Id, and nothing else from the source', () => {
    expect(build().exercises.map((e) => e.id)).toEqual([
      'Band_Pull_Apart',
      'Bodyweight_Squat',
      'Chair_Upper_Body_Stretch',
      'Hammer_Curls',
      'Plank',
      'Side_Neck_Stretch',
      'Star_Jump',
      'custom/chin_tuck',
    ]);
  });
});

describe('buildLibrary: self-authored', () => {
  it('ships a custom/ Exercise as self-authored, written in full, with no photos', () => {
    expect(byId(build().exercises, 'custom/chin_tuck')).toEqual({
      id: 'custom/chin_tuck',
      source: 'self-authored',
      name: 'Chin Tuck',
      targetMuscles: ['neck'],
      bodyArea: 'Neck',
      exerciseType: 'Strength',
      difficulty: 'Beginner',
      position: 'Either',
      equipment: null,
      energetic: false,
      dose: { kind: 'reps', amount: 10, eachSide: false },
      cue: 'Glide your chin straight back, make a double chin',
      steps: [
        'Sit or stand tall, looking straight ahead.',
        'Glide your chin straight back without tilting your head.',
        'Hold for a moment, then release.',
      ],
      photos: null,
    });
  });
});

describe('buildLibrary: unknown Id', () => {
  it('fails on a curation Id missing from the source, naming the Id and its group', () => {
    expectBuildError(
      () => build({ curation: { ...curation, floor: curation.floor + entryYaml('Not_A_Real_Id') } }),
      'Not_A_Real_Id',
      'floor',
    );
  });
});

describe('buildLibrary: sourceId', () => {
  it('builds a renamed entry from its sourceId, keeps the frozen Id and warns naming both', () => {
    const { exercises, warnings } = build({
      curation: { ...curation, base: curation.base + entryYaml('Arm_Circles', '\n  sourceId: Arm_Circles_Standing') },
    });
    const circles = byId(exercises, 'Arm_Circles');

    expect(circles.name).toBe('Arm Circles');
    expect(circles.targetMuscles).toEqual(['shoulders']);
    expect(circles.photos).toEqual({ start: 'Arm_Circles_Standing/0.jpg', end: 'Arm_Circles_Standing/1.jpg' });
    expect(exercises.some((e) => e.id === 'Arm_Circles_Standing')).toBe(false);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Arm_Circles');
    expect(warnings[0]).toContain('Arm_Circles_Standing');
  });

  it('fails when the sourceId is itself missing from the source', () => {
    expectBuildError(
      () => build({ curation: { ...curation, base: curation.base + entryYaml('Arm_Circles', '\n  sourceId: Arm_Circles_Gone') } }),
      'Arm_Circles_Gone',
    );
  });
});

describe('buildLibrary: photo index', () => {
  const requires = (photoIndex: string) =>
    [...photoIndex.matchAll(/'([^']+)':\s*require\('([^']+)'\)/g)].map(([, key, path]) => [key, path]);

  it('has exactly one require per photo of each shipped Exercise, in Id order, start before end', () => {
    expect(requires(build().photoIndex)).toEqual([
      ['Bodyweight_Squat/0.jpg', './photos/Bodyweight_Squat/0.webp'],
      ['Bodyweight_Squat/1.jpg', './photos/Bodyweight_Squat/1.webp'],
      ['Chair_Upper_Body_Stretch/0.jpg', './photos/Chair_Upper_Body_Stretch/0.webp'],
      ['Chair_Upper_Body_Stretch/1.jpg', './photos/Chair_Upper_Body_Stretch/1.webp'],
      ['Hammer_Curls/0.jpg', './photos/Hammer_Curls/0.webp'],
      ['Hammer_Curls/1.jpg', './photos/Hammer_Curls/1.webp'],
      ['Plank/0.jpg', './photos/Plank/0.webp'],
      ['Plank/1.jpg', './photos/Plank/1.webp'],
      ['Side_Neck_Stretch/0.jpg', './photos/Side_Neck_Stretch/0.webp'],
      ['Side_Neck_Stretch/1.jpg', './photos/Side_Neck_Stretch/1.webp'],
      ['Star_Jump/0.jpg', './photos/Star_Jump/0.webp'],
      ['Star_Jump/1.jpg', './photos/Star_Jump/1.webp'],
    ]);
  });

  it('has one require call per photo in total, none for Exercises without photos', () => {
    const { photoIndex } = build();

    expect(photoIndex.match(/require\(/g)).toHaveLength(12);
    expect(photoIndex).not.toContain('chin_tuck');
    expect(photoIndex).not.toContain('Band_Pull_Apart');
    expect(photoIndex).not.toContain('Leg_Extensions'); // not curated
  });

  it('is the same whatever order the curation groups come in', () => {
    const reversed = Object.fromEntries(Object.entries(curation).reverse());

    expect(build({ curation: reversed }).photoIndex).toBe(build().photoIndex);
  });

  it('fails when a photo file is missing, naming the file', () => {
    expectBuildError(() => build({ photoExists: (path) => path !== 'Star_Jump/1.jpg' }), 'Star_Jump/1.jpg');
  });
});

describe('buildLibrary: validation', () => {
  it('rejects an invalid Position, naming the Id, the field and the value', () => {
    const bad = curation.base.replace('position: Either', 'position: Lying');

    expectBuildError(() => build({ curation: { ...curation, base: bad } }), 'Side_Neck_Stretch', 'position', 'Lying');
  });

  it('rejects an entry missing a required field, naming the Id and the field', () => {
    const bad = curation.base.replace('  cue: Drop ear to shoulder, keep shoulders down\n', '');

    expectBuildError(() => build({ curation: { ...curation, base: bad } }), 'Side_Neck_Stretch', 'cue');
  });

  it('rejects a Dose with neither reps nor seconds', () => {
    const bad = curation.floor.replace('    seconds: 30', '    minutes: 1');

    expectBuildError(() => build({ curation: { ...curation, floor: bad } }), 'Plank', 'dose');
  });

  it('rejects the same Id curated in two groups, naming the Id and both groups', () => {
    expectBuildError(
      () => build({ curation: { ...curation, floor: curation.floor + entryYaml('Bodyweight_Squat') } }),
      'Bodyweight_Squat',
      'base',
      'floor',
    );
  });

  it.each([
    ['Leg_Extensions', 'machine'],
    ['Kettlebell_Windmill', 'kettlebells'],
  ])('rejects curating %s, whose source Equipment "%s" is not v1 Equipment, naming the Id and the source Equipment', (id, equipment) => {
    expectBuildError(
      () => build({ curation: { ...curation, base: curation.base + entryYaml(id) } }),
      id,
      `"${equipment}"`,
      'not v1 Equipment',
    );
  });
});

describe('buildLibrary: steps carry no count', () => {
  it('rejects a source-backed step with a digit, naming the Id and the step', () => {
    const bad = curation.base.replace('Drive through your heels to stand.', 'Drive through your heels to stand 10 times.');

    expectBuildError(
      () => build({ curation: { ...curation, base: bad } }),
      'Bodyweight_Squat',
      'Drive through your heels to stand 10 times.',
    );
  });

  it('rejects a self-authored step with a digit, naming the Id', () => {
    const bad = curation.base.replace('Hold for a moment, then release.', 'Hold for 5 seconds, then release.');

    expectBuildError(() => build({ curation: { ...curation, base: bad } }), 'custom/chin_tuck', 'Hold for 5 seconds');
  });
});

describe('buildLibrary: strict curation', () => {
  it('rejects an unknown key in a curation entry, naming the Id and the key', () => {
    expectBuildError(
      () => build({ curation: { ...curation, base: curation.base + entryYaml('Arm_Circles_Standing', '\n  cues: A typo') } }),
      'Arm_Circles_Standing',
      'cues',
    );
  });
});

describe('buildLibrary: Target Muscles', () => {
  it('rejects a Target Muscle outside the 17 source muscles, naming the Id and the value', () => {
    const bad = curation.base.replace('targetMuscles: [chest, shoulders]', 'targetMuscles: [chest, pecs]');

    expectBuildError(() => build({ curation: { ...curation, base: bad } }), 'Chair_Upper_Body_Stretch', 'targetMuscles', 'pecs');
  });
});

describe('buildLibrary: unknown groups', () => {
  it('rejects a curation group that is not one of the four, naming the group', () => {
    const withStray: Record<string, string> = { ...curation, stretches: entryYaml('Arm_Circles_Standing') };

    expectBuildError(() => build({ curation: withStray as BuildInput['curation'] }), 'stretches');
  });

  it.each(['kettlebell', 'medicine-ball', 'exercise-ball', 'foam-roller'])(
    'rejects %s.yaml, a group that left v1, as an unknown group',
    (group) => {
      const withGone: Record<string, string> = { ...curation, [group]: fixture('curation/retired-group.yaml') };

      expectBuildError(() => build({ curation: withGone as BuildInput['curation'] }), `Unknown curation group ${group}`);
    },
  );
});

describe('buildLibrary: group consistency', () => {
  it('rejects a floor entry whose Position is not Floor, naming the Id and the group', () => {
    expectBuildError(
      () => build({ curation: { ...curation, floor: curation.floor + entryYaml('Calf_Stretch_Hands_Against_Wall') } }),
      'Calf_Stretch_Hands_Against_Wall',
      'floor',
    );
  });
});

describe('buildLibrary: group consistency, base', () => {
  it('rejects a base entry with Position Floor, naming the Id and the group', () => {
    const floorInBase = entryYaml('Calf_Stretch_Hands_Against_Wall').replace('position: Standing', 'position: Floor');

    expectBuildError(
      () => build({ curation: { ...curation, base: curation.base + floorInBase } }),
      'Calf_Stretch_Hands_Against_Wall',
      'base',
    );
  });
});

describe('buildLibrary: group consistency, base Equipment', () => {
  it('rejects a base entry whose source maps to Equipment, naming the Id and the group', () => {
    const withoutDumbbells = { ...curation, dumbbells: '' };

    expectBuildError(
      () => build({ curation: { ...withoutDumbbells, base: curation.base + entryYaml('Hammer_Curls') } }),
      'Hammer_Curls',
      'base',
    );
  });

  it('rejects a self-authored base entry written with Equipment, naming the Id and the group', () => {
    const bad = curation.base.replace('  equipment: null\n', '  equipment: dumbbells\n');

    expectBuildError(() => build({ curation: { ...curation, base: bad } }), 'custom/chin_tuck', 'base');
  });
});

describe('buildLibrary: group consistency, Equipment groups', () => {
  const chinTuckIn = (equipment: string) => `
custom/band_chin_tuck:
  name: Band Chin Tuck
  targetMuscles: [neck]
  bodyArea: Neck
  exerciseType: Strength
  difficulty: Beginner
  position: Either
  equipment: ${equipment}
  energetic: false
  dose:
    reps: 10
  cue: Press back into the band
  steps:
    - Loop a band behind your head and hold the ends in front.
`;

  it('rejects a source entry in an Equipment group whose source Equipment differs, naming the Id and the group', () => {
    expectBuildError(
      () =>
        build({
          curation: { ...curation, dumbbells: '', 'resistance-bands': curation['resistance-bands'] + entryYaml('Hammer_Curls') },
        }),
      'Hammer_Curls',
      'resistance-bands',
    );
  });

  it('rejects a no-equipment source entry in an Equipment group, naming the Id and the group', () => {
    expectBuildError(
      () => build({ curation: { ...curation, dumbbells: curation.dumbbells + entryYaml('Calf_Stretch_Hands_Against_Wall') } }),
      'Calf_Stretch_Hands_Against_Wall',
      'dumbbells',
    );
  });

  it('rejects a self-authored entry written with another Equipment than its group, naming the Id and the group', () => {
    expectBuildError(
      () => build({ curation: { ...curation, 'resistance-bands': chinTuckIn('null') } }),
      'custom/band_chin_tuck',
      'resistance-bands',
    );
  });

  it('builds a self-authored entry written with its group Equipment', () => {
    const { exercises } = build({ curation: { ...curation, 'resistance-bands': chinTuckIn('resistance bands') } });

    expect(byId(exercises, 'custom/band_chin_tuck').equipment).toBe('resistance bands');
  });
});

describe('buildLibrary: Equipment on a source-backed entry', () => {
  it('accepts an equipment field that matches the source mapping, as the draft script writes it', () => {
    const drafted = curation.dumbbells.replace('  position: Either\n', '  position: Either\n  equipment: dumbbells\n');

    expect(byId(build({ curation: { ...curation, dumbbells: drafted } }).exercises, 'Hammer_Curls').equipment).toBe(
      'dumbbells',
    );
  });

  it('rejects an equipment field that differs from the source mapping, naming the Id and the field', () => {
    const bad = curation.dumbbells.replace('  position: Either\n', '  position: Either\n  equipment: resistance bands\n');

    expectBuildError(() => build({ curation: { ...curation, dumbbells: bad } }), 'Hammer_Curls', 'equipment');
  });
});

describe('buildLibrary: group consistency, floor Equipment', () => {
  it('rejects a floor entry with Equipment, naming the Id, floor and the Equipment', () => {
    const floorPress = `
custom/dumbbell_floor_press:
  name: Dumbbell Floor Press
  targetMuscles: [chest]
  bodyArea: Chest & Arms
  exerciseType: Strength
  difficulty: Beginner
  position: Floor
  equipment: dumbbells
  energetic: false
  dose:
    reps: 10
  cue: Press the dumbbells up over your chest
  steps:
    - Lie on your back holding a dumbbell in each hand.
`;

    expectBuildError(
      () => build({ curation: { ...curation, floor: curation.floor + floorPress } }),
      'custom/dumbbell_floor_press',
      'floor',
      'dumbbells',
    );
  });
});
