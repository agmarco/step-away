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
  kettlebell: fixture('curation/kettlebell.yaml'),
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
    expect(byId(exercises, 'Kettlebell_Windmill').equipment).toBe('kettlebell');
  });

  it('falls back to the source level for Difficulty and has no photos when the source has no images', () => {
    const windmill = byId(build().exercises, 'Kettlebell_Windmill');

    expect(windmill.difficulty).toBe('Intermediate');
    expect(windmill.bodyArea).toBe('Core & Lower Back');
    expect(windmill.dose).toEqual({ kind: 'reps', amount: 5, eachSide: true });
    expect(windmill.photos).toBeNull();
  });

  it('builds without warnings when nothing is renamed', () => {
    expect(build().warnings).toEqual([]);
  });
});

describe('buildLibrary: curated only', () => {
  it('ships exactly the curated Exercises, sorted by Id, and nothing else from the source', () => {
    expect(build().exercises.map((e) => e.id)).toEqual([
      'Bodyweight_Squat',
      'Chair_Upper_Body_Stretch',
      'Hammer_Curls',
      'Kettlebell_Windmill',
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
      ['Bodyweight_Squat/0.jpg', './photos/Bodyweight_Squat/0.jpg'],
      ['Bodyweight_Squat/1.jpg', './photos/Bodyweight_Squat/1.jpg'],
      ['Chair_Upper_Body_Stretch/0.jpg', './photos/Chair_Upper_Body_Stretch/0.jpg'],
      ['Chair_Upper_Body_Stretch/1.jpg', './photos/Chair_Upper_Body_Stretch/1.jpg'],
      ['Hammer_Curls/0.jpg', './photos/Hammer_Curls/0.jpg'],
      ['Hammer_Curls/1.jpg', './photos/Hammer_Curls/1.jpg'],
      ['Plank/0.jpg', './photos/Plank/0.jpg'],
      ['Plank/1.jpg', './photos/Plank/1.jpg'],
      ['Side_Neck_Stretch/0.jpg', './photos/Side_Neck_Stretch/0.jpg'],
      ['Side_Neck_Stretch/1.jpg', './photos/Side_Neck_Stretch/1.jpg'],
      ['Star_Jump/0.jpg', './photos/Star_Jump/0.jpg'],
      ['Star_Jump/1.jpg', './photos/Star_Jump/1.jpg'],
    ]);
  });

  it('has one require call per photo in total, none for Exercises without photos', () => {
    const { photoIndex } = build();

    expect(photoIndex.match(/require\(/g)).toHaveLength(12);
    expect(photoIndex).not.toContain('chin_tuck');
    expect(photoIndex).not.toContain('Kettlebell_Windmill');
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

  it('rejects curating an entry whose source Equipment is ineligible', () => {
    expectBuildError(
      () => build({ curation: { ...curation, base: curation.base + entryYaml('Leg_Extensions') } }),
      'Leg_Extensions',
      'machine',
    );
  });
});
