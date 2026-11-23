import { describe, expect, it } from 'vitest';
import {
  initialState,
  reduce,
  seededRandom,
  type BodyArea,
  type CoreDeps,
  type CoreEvent,
  type CoreState,
  type Dose,
  type Exercise,
  type Reminder,
  type Settings,
  type SuggestedExercise,
} from './index';

// All local times below are Europe/Madrid in November 2026: CET, UTC+1, no DST change.
// Default Settings: Mon-Fri 09:00-18:00, 45-minute Interval. A Monday 08:00 Rearm gives
// the chain 09:45, 10:30, ...; at 10:00 every Reminder after 10:00 is the chain ahead.
const ZONE = 'Europe/Madrid';
const local = (date: string, time: string): number => Date.parse(`${date}T${time}:00+01:00`);
const MON = '2026-11-02';
const at = (time: string) => local(MON, time);

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
const snapshot = ({ id, name, dose, cue, bodyArea }: Exercise): SuggestedExercise => ({ id, name, dose, cue, bodyArea });

const NECK_TURN = exercise('Neck_Turn', 'Neck');
const OTHERS = [
  exercise('Neck_Tilt', 'Neck'),
  exercise('Shoulder_Roll', 'Shoulders & Upper Back'),
  exercise('Wrist_Circle', 'Wrists & Forearms'),
  exercise('Hip_Hinge', 'Hips & Legs'),
];
const LIBRARY = [NECK_TURN, ...OTHERS];

const cfg = (settings: Partial<Settings> = {}): CoreState => ({
  ...initialState,
  settings: { ...initialState.settings, timeZone: ZONE, ...settings },
});
const depsAt = (when: number, library: readonly Exercise[]): CoreDeps => ({
  clock: { now: () => when },
  random: seededRandom(7),
  library,
});
type Change = Extract<CoreEvent, { type: 'ChangeSettings' }>['change'];
const rearm = (state: CoreState, when: number, library: readonly Exercise[]) =>
  reduce(state, { type: 'Rearm' }, depsAt(when, library));
const change = (state: CoreState, c: Change, when: number, library: readonly Exercise[]) =>
  reduce(state, { type: 'ChangeSettings', change: c }, depsAt(when, library));

const aheadOf = (state: CoreState, when: number): Reminder[] => {
  const ahead = state.reminders.filter((r) => r.firesAt > when);
  expect(ahead.length).toBeGreaterThan(10);
  return ahead;
};
const idsAhead = (state: CoreState, when: number) => aheadOf(state, when).flatMap((r) => r.suggestion.map((e) => e.id));

describe('Exclude and Bring back', () => {
  it('an Exercise Excluded through ChangeSettings is never suggested in the chain ahead', () => {
    const armed = rearm(cfg(), at('08:00'), LIBRARY).state;
    expect(idsAhead(armed, at('10:00'))).toContain('Neck_Turn');

    const result = change(armed, { excluded: ['Neck_Turn'] }, at('10:00'), LIBRARY);

    expect(result.state.settings.excluded).toEqual(['Neck_Turn']);
    expect(idsAhead(result.state, at('10:00'))).not.toContain('Neck_Turn');
    for (const r of aheadOf(result.state, at('10:00'))) expect(r).not.toHaveProperty('fallback');
  });

  it('a brought-back Exercise is suggested again', () => {
    // Two Exercises, two per Suggestion: while Neck_Turn is Excluded each Suggestion is
    // Shoulder_Roll alone; brought back, it is in every one.
    const library = [NECK_TURN, exercise('Shoulder_Roll', 'Shoulders & Upper Back')];
    const excluded = change(
      rearm(cfg({ exercisesPerSuggestion: 2 }), at('08:00'), library).state,
      { excluded: ['Neck_Turn'] },
      at('10:00'),
      library,
    ).state;
    expect(idsAhead(excluded, at('10:00'))).not.toContain('Neck_Turn');

    const result = change(excluded, { excluded: [] }, at('10:05'), library);

    for (const r of aheadOf(result.state, at('10:05'))) {
      expect(r.suggestion.map((e) => e.id).sort()).toEqual(['Neck_Turn', 'Shoulder_Roll']);
    }
  });

  it('an Excluded Exercise with a Dose override comes back as the fallback with the overridden Dose', () => {
    // Neck_Turn is the only Exercise: Excluded, the pool is empty and it is the fallback.
    const library = [NECK_TURN];
    const override: Dose = { kind: 'seconds', amount: 25, eachSide: true };
    const armed = rearm(cfg(), at('08:00'), library).state;

    const result = change(
      armed,
      { excluded: ['Neck_Turn'], doseOverrides: { Neck_Turn: override } },
      at('10:00'),
      library,
    );

    for (const r of aheadOf(result.state, at('10:00'))) {
      expect(r.fallback).toBe(true);
      expect(r.suggestion).toStrictEqual([{ ...snapshot(NECK_TURN), dose: override }]);
    }
  });
});
