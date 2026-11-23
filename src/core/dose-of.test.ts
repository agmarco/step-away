import { describe, expect, it } from 'vitest';
import { defaultSettings, doseOf, type Dose, type Exercise, type Settings } from './index';

const NECK_TURN: Exercise = {
  id: 'Neck_Turn',
  source: 'free-exercise-db',
  name: 'Neck Turn',
  targetMuscles: ['neck'],
  bodyArea: 'Neck',
  exerciseType: 'Stretch',
  difficulty: 'Beginner',
  position: 'Either',
  equipment: null,
  energetic: false,
  dose: { kind: 'reps', amount: 10, eachSide: false },
  cue: 'Turn slowly.',
  steps: ['Do it.'],
  photos: null,
};

const TWENTY_FIVE_EACH_SIDE: Dose = { kind: 'seconds', amount: 25, eachSide: true };
const withOverrides = (doseOverrides: Settings['doseOverrides']): Settings => ({ ...defaultSettings, doseOverrides });

describe('doseOf', () => {
  it('is the library Dose when the Exercise has no override', () => {
    expect(doseOf(NECK_TURN, defaultSettings)).toEqual({ kind: 'reps', amount: 10, eachSide: false });
  });

  it('is the override when the Exercise has one', () => {
    const settings = withOverrides({ Neck_Turn: TWENTY_FIVE_EACH_SIDE });
    expect(doseOf(NECK_TURN, settings)).toEqual({ kind: 'seconds', amount: 25, eachSide: true });
  });

  it("ignores another Exercise's override", () => {
    const settings = withOverrides({ Shoulder_Roll: TWENTY_FIVE_EACH_SIDE });
    expect(doseOf(NECK_TURN, settings)).toEqual({ kind: 'reps', amount: 10, eachSide: false });
  });
});
