import { describe, expect, it } from 'vitest';
import { allowedBySettings, initialState, type Exercise, type Settings } from './index';

const exercise = (id: string, overrides: Partial<Exercise> = {}): Exercise => ({
  id,
  source: 'free-exercise-db',
  name: id.replace(/_/g, ' '),
  targetMuscles: ['neck'],
  bodyArea: 'Neck',
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
const ids = (list: Exercise[]) => list.map((e) => e.id);

describe('allowedBySettings: the Exercises the settings allow, Exclusions ignored', () => {
  it('keeps an Excluded Exercise that the other settings allow', () => {
    const library = [exercise('Neck_Turn'), exercise('Neck_Tilt')];

    expect(ids(allowedBySettings(settings({ excluded: ['Neck_Turn'] }), library))).toEqual(['Neck_Turn', 'Neck_Tilt']);
  });

  it('drops an Exercise above the Difficulty ceiling, keeping the ones at or below it', () => {
    const library = [
      exercise('Easy', { difficulty: 'Beginner' }),
      exercise('Medium', { difficulty: 'Intermediate' }),
      exercise('Hard', { difficulty: 'Expert' }),
    ];

    expect(ids(allowedBySettings(settings({ difficulty: 'Intermediate' }), library))).toEqual(['Easy', 'Medium']);
  });

  it('drops Energetic Exercises while Energetic is off, and keeps them once it is on', () => {
    const library = [exercise('Jumping_Jacks', { energetic: true }), exercise('Neck_Turn')];

    expect(ids(allowedBySettings(settings({ energetic: false }), library))).toEqual(['Neck_Turn']);
    expect(ids(allowedBySettings(settings({ energetic: true }), library))).toEqual(['Jumping_Jacks', 'Neck_Turn']);
  });

  it('drops Floor Exercises while Floor is off, and keeps them once it is on', () => {
    const library = [exercise('Plank', { position: 'Floor' }), exercise('Neck_Turn')];

    expect(ids(allowedBySettings(settings({ floor: false }), library))).toEqual(['Neck_Turn']);
    expect(ids(allowedBySettings(settings({ floor: true }), library))).toEqual(['Plank', 'Neck_Turn']);
  });

  it('keeps an Equipment Exercise only when its Equipment is owned', () => {
    const library = [
      exercise('Dumbbell_Curl', { equipment: 'dumbbells' }),
      exercise('Band_Pull_Apart', { equipment: 'resistance bands' }),
      exercise('Neck_Turn'),
    ];

    expect(ids(allowedBySettings(settings({ equipment: ['dumbbells'] }), library))).toEqual(['Dumbbell_Curl', 'Neck_Turn']);
  });
});
