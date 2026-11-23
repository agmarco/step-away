import { describe, expect, it } from 'vitest';
import { initialState, type BodyArea, type Exercise, type Settings } from '../../core';
import { libraryBrowser } from './libraryBrowser';

const exercise = (id: string, bodyArea: BodyArea, overrides: Partial<Exercise> = {}): Exercise => ({
  id,
  source: 'free-exercise-db',
  name: id.replace(/_/g, ' '),
  targetMuscles: ['neck'],
  bodyArea,
  exerciseType: 'Stretch',
  difficulty: 'Beginner',
  position: 'Either',
  equipment: null,
  energetic: false,
  dose: { kind: 'reps', amount: 10, eachSide: false },
  cue: `Cue for ${id}`,
  steps: ['Do it.'],
  photos: null,
  ...overrides,
});

const settings = (change: Partial<Settings> = {}): Settings => ({ ...initialState.settings, ...change });

const WRIST = exercise('Wrist_Circles', 'Wrists & Forearms');
const NECK_TURN = exercise('Neck_Turn', 'Neck');
const NECK_TILT = exercise('Neck_Tilt', 'Neck');
const STAR_JUMP = exercise('Star_Jump', 'Hips & Legs', { energetic: true });
const HIP_HINGE = exercise('Hip_Hinge', 'Hips & Legs');
const LIBRARY = [WRIST, NECK_TURN, STAR_JUMP, NECK_TILT, HIP_HINGE];

/** Each section as its Body Area and its row names. */
const outline = (b: ReturnType<typeof libraryBrowser>) => b.sections.map((s) => [s.bodyArea, s.rows.map((r) => r.name)]);

describe('libraryBrowser: the browser rows for a filter', () => {
  it('All lists the Exercises the settings allow, by Body Area in BODY_AREAS order, then by name', () => {
    const browser = libraryBrowser(settings(), LIBRARY, 'All');

    expect(outline(browser)).toEqual([
      ['Neck', ['Neck Tilt', 'Neck Turn']],
      ['Wrists & Forearms', ['Wrist Circles']],
      ['Hips & Legs', ['Hip Hinge']],
    ]);
  });

  it('All keeps an Excluded Exercise, marked Excluded', () => {
    const browser = libraryBrowser(settings({ excluded: ['Neck_Turn'] }), LIBRARY, 'All');

    const rows = browser.sections.flatMap((s) => s.rows);
    expect(rows.map((r) => [r.id, r.excluded])).toEqual([
      ['Neck_Tilt', false],
      ['Neck_Turn', true],
      ['Wrist_Circles', false],
      ['Hip_Hinge', false],
    ]);
  });

  it('a row shows the effective Dose and is marked Customised when it has an override', () => {
    const override = { kind: 'seconds', amount: 30, eachSide: true } as const;
    const browser = libraryBrowser(settings({ doseOverrides: { Hip_Hinge: override } }), LIBRARY, 'All');

    const rows = browser.sections.flatMap((s) => s.rows);
    expect(rows.find((r) => r.id === 'Hip_Hinge')).toMatchObject({ dose: '30 s each side', customised: true });
    expect(rows.find((r) => r.id === 'Neck_Tilt')).toMatchObject({ dose: '10 reps', customised: false });
  });

  it('Excluded lists only the allowed Excluded Exercises; an Excluded one the settings rule out is not listed', () => {
    const browser = libraryBrowser(settings({ excluded: ['Neck_Turn', 'Star_Jump'] }), LIBRARY, 'Excluded');

    expect(outline(browser)).toEqual([['Neck', ['Neck Turn']]]);
  });

  it('Customised lists only the allowed Exercises with an override', () => {
    const doseOverrides = {
      Wrist_Circles: { kind: 'reps', amount: 15, eachSide: false },
      Star_Jump: { kind: 'reps', amount: 20, eachSide: false },
    } as const;
    const browser = libraryBrowser(settings({ doseOverrides }), LIBRARY, 'Customised');

    expect(outline(browser)).toEqual([['Wrists & Forearms', ['Wrist Circles']]]);
  });

  it('counts each filter among the allowed Exercises, whatever the filter shown', () => {
    const browser = libraryBrowser(
      settings({
        excluded: ['Neck_Turn', 'Hip_Hinge', 'Star_Jump'],
        doseOverrides: { Neck_Turn: { kind: 'reps', amount: 12, eachSide: false } },
      }),
      LIBRARY,
      'Customised',
    );

    expect(browser.counts).toEqual({ All: 4, Excluded: 2, Customised: 1 });
  });

  it('a filter with nothing in it has no sections', () => {
    expect(libraryBrowser(settings(), LIBRARY, 'Excluded').sections).toEqual([]);
  });
});
