import { describe, expect, it } from 'vitest';
import type { Exercise, Reminder, SuggestedExercise } from '../../core';
import { exercisesShown } from './entries';

const exercise = (id: string, name: string, photos: Exercise['photos'] = null): Exercise => ({
  id,
  source: 'free-exercise-db',
  name,
  targetMuscles: ['neck'],
  bodyArea: 'Neck',
  exerciseType: 'Stretch',
  difficulty: 'Beginner',
  position: 'Either',
  equipment: null,
  energetic: false,
  dose: { kind: 'reps', amount: 10, eachSide: false },
  cue: 'Cue',
  steps: ['Do it.'],
  photos,
});

const suggested = (id: string, name: string): SuggestedExercise => ({
  id,
  name,
  dose: { kind: 'reps', amount: 10, eachSide: false },
  cue: 'Cue',
  bodyArea: 'Neck',
});

const LIBRARY = [
  exercise('Neck_Tilt', 'Neck Tilt', { start: 'Neck_Tilt/0.jpg', end: 'Neck_Tilt/1.jpg' }),
  exercise('Wrist_Circles', 'Wrist Circles'),
  // Renamed since the Suggestion snapshotted it as "Shoulder Roll".
  exercise('Shoulder_Roll', 'Shoulder Rolls', { start: 'Shoulder_Roll/0.jpg', end: 'Shoulder_Roll/1.jpg' }),
];

const reminder = (overrides: Partial<Reminder>): Reminder => ({
  id: 'r',
  firesAt: 0,
  suggestion: [],
  status: 'missed',
  ...overrides,
});

describe("exercisesShown: a History row's Exercises", () => {
  it.each(['scheduled', 'skipped', 'missed', 'dropped'] as const)('shows no Exercises for a %s Reminder', (status) => {
    const r = reminder({ status, suggestion: [suggested('Neck_Tilt', 'Neck Tilt'), suggested('Wrist_Circles', 'Wrist Circles')] });

    expect(exercisesShown(r, LIBRARY)).toEqual([]);
  });

  it("uses the library's current name for a renamed Exercise", () => {
    const r = reminder({
      status: 'done',
      suggestion: [suggested('Shoulder_Roll', 'Shoulder Roll')],
      done: [{ id: 'Shoulder_Roll', name: 'Shoulder Roll', bodyArea: 'Shoulders & Upper Back' }],
    });

    expect(exercisesShown(r, LIBRARY)).toEqual([{ id: 'Shoulder_Roll', name: 'Shoulder Rolls', photo: 'Shoulder_Roll/0.jpg' }]);
  });

  it('falls back to the snapshot name, with no photo, for an Exercise no longer in the library', () => {
    const r = reminder({
      status: 'done',
      suggestion: [suggested('Gone_Stretch', 'Gone Stretch'), suggested('Neck_Tilt', 'Neck Tilt')],
      done: [
        { id: 'Gone_Stretch', name: 'Gone Stretch', bodyArea: 'Neck' },
        { id: 'Neck_Tilt', name: 'Neck Tilt', bodyArea: 'Neck' },
      ],
    });

    expect(exercisesShown(r, LIBRARY)).toEqual([
      { id: 'Gone_Stretch', name: 'Gone Stretch' },
      { id: 'Neck_Tilt', name: 'Neck Tilt', photo: 'Neck_Tilt/0.jpg' },
    ]);
  });

  it('shows only the Done list of a done Reminder: not the rest of its Suggestion, nor the Exercises swapped out', () => {
    const r = reminder({
      status: 'done',
      suggestion: [suggested('Neck_Tilt', 'Neck Tilt'), suggested('Wrist_Circles', 'Wrist Circles')],
      done: [{ id: 'Wrist_Circles', name: 'Wrist Circles', bodyArea: 'Wrists & Forearms' }],
      swappedOut: ['Shoulder_Roll'],
    });

    expect(exercisesShown(r, LIBRARY)).toEqual([{ id: 'Wrist_Circles', name: 'Wrist Circles' }]);
  });

  it("falls back to the Done list's snapshot name for a deleted Exercise", () => {
    const r = reminder({
      status: 'done',
      suggestion: [suggested('Gone_Stretch', 'Gone Stretch'), suggested('Neck_Tilt', 'Neck Tilt')],
      done: [{ id: 'Gone_Stretch', name: 'Gone Stretch', bodyArea: 'Neck' }],
    });

    expect(exercisesShown(r, LIBRARY)).toEqual([{ id: 'Gone_Stretch', name: 'Gone Stretch' }]);
  });
});
