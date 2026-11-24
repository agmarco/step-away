import { describe, expect, it } from 'vitest';
import { exerciseGroups, type Exercise } from './index';

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

describe('exerciseGroups: the groups with at least one Exercise', () => {
  it('a library with no Floor and no Equipment Exercise has no groups', () => {
    const library = [exercise('Seated', { position: 'Seated' }), exercise('Standing', { position: 'Standing' })];

    expect(exerciseGroups(library)).toEqual({ floor: false, equipment: [] });
  });

  it('a Floor Exercise and dumbbells and bands give Floor and exactly those two, in EQUIPMENT order', () => {
    const library = [
      exercise('Band_Pull_Apart', { equipment: 'resistance bands' }),
      exercise('Plank', { position: 'Floor' }),
      exercise('Dumbbell_Curl', { equipment: 'dumbbells' }),
      exercise('Dumbbell_Row', { equipment: 'dumbbells' }),
      exercise('Neck_Stretch'),
    ];

    expect(exerciseGroups(library)).toEqual({ floor: true, equipment: ['dumbbells', 'resistance bands'] });
  });

  it('an Exercise that is both Floor and Equipment counts for both', () => {
    const library = [exercise('Dumbbell_Floor_Press', { position: 'Floor', equipment: 'dumbbells' })];

    expect(exerciseGroups(library)).toEqual({ floor: true, equipment: ['dumbbells'] });
  });

  it('an empty library has no groups', () => {
    expect(exerciseGroups([])).toEqual({ floor: false, equipment: [] });
  });
});
