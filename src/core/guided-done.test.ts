import { describe, expect, it } from 'vitest';
import {
  initialState,
  outstandingReminder,
  reduce,
  seededRandom,
  type CoreDeps,
  type CoreResult,
  type CoreState,
  type Exercise,
  type Intent,
  type Reminder,
  type ScheduledNotification,
  type SuggestedExercise,
} from './index';

// All local times below are Europe/Madrid in November 2026: CET, UTC+1, no DST change.
// Default Settings: Mon-Fri 09:00-18:00, 45-minute Interval, 10-minute Snooze delay.
// The no-Response Monday chain is 09:45 + k·45: 09:45, 10:30, ..., 16:30, 17:15.
const ZONE = 'Europe/Madrid';
const local = (date: string, time: string): number => Date.parse(`${date}T${time}:00+01:00`);
const MON = '2026-11-02';
const TUE = '2026-11-03';
const at = (time: string) => local(MON, time);

const exercise = (
  overrides: Partial<Exercise> & Pick<Exercise, 'id' | 'name' | 'dose' | 'cue' | 'bodyArea'>,
): Exercise => ({
  source: 'free-exercise-db',
  targetMuscles: ['neck'],
  exerciseType: 'Stretch',
  difficulty: 'Beginner',
  position: 'Either',
  equipment: null,
  energetic: false,
  steps: ['Do it.'],
  photos: null,
  ...overrides,
});

// Five Exercises in five Body Areas, so a snapshot's Body Area tells them apart.
const library = [
  exercise({
    id: 'Side_Neck_Stretch',
    name: 'Side Neck Stretch',
    dose: { kind: 'seconds', amount: 20, eachSide: true },
    cue: 'Ear to shoulder, shoulders stay down',
    bodyArea: 'Neck',
  }),
  exercise({
    id: 'Isometric_Chest_Squeezes',
    name: 'Chest Squeeze',
    dose: { kind: 'seconds', amount: 20, eachSide: false },
    cue: 'Press palms together hard, keep breathing',
    bodyArea: 'Chest & Arms',
  }),
  exercise({
    id: 'Bodyweight_Squat',
    name: 'Bodyweight Squat',
    dose: { kind: 'reps', amount: 10, eachSide: false },
    cue: 'Sit back, chest up, knees over toes',
    bodyArea: 'Hips & Legs',
  }),
  exercise({
    id: 'Wrist_Circles',
    name: 'Wrist Circles',
    dose: { kind: 'reps', amount: 10, eachSide: false },
    cue: 'Slow full circles, both directions',
    bodyArea: 'Wrists & Forearms',
  }),
  exercise({
    id: 'Shoulder_Rolls',
    name: 'Shoulder Rolls',
    dose: { kind: 'reps', amount: 10, eachSide: false },
    cue: 'Up, back and down, slowly',
    bodyArea: 'Shoulders & Upper Back',
  }),
];

/** A known three-Exercise Suggestion, set on the 09:45 Reminder by `morning`. */
const SUGGESTION: SuggestedExercise[] = [
  {
    id: 'Side_Neck_Stretch',
    name: 'Side Neck Stretch',
    dose: { kind: 'seconds', amount: 20, eachSide: true },
    cue: 'Ear to shoulder, shoulders stay down',
    bodyArea: 'Neck',
  },
  {
    id: 'Bodyweight_Squat',
    name: 'Bodyweight Squat',
    dose: { kind: 'reps', amount: 10, eachSide: false },
    cue: 'Sit back, chest up, knees over toes',
    bodyArea: 'Hips & Legs',
  },
  {
    id: 'Wrist_Circles',
    name: 'Wrist Circles',
    dose: { kind: 'reps', amount: 10, eachSide: false },
    cue: 'Slow full circles, both directions',
    bodyArea: 'Wrists & Forearms',
  },
];

const start: CoreState = {
  ...initialState,
  settings: { ...initialState.settings, timeZone: ZONE, exercisesPerSuggestion: 3 },
};

const depsAt = (when: number, lib: readonly Exercise[] = library): CoreDeps => ({
  clock: { now: () => when },
  random: seededRandom(7),
  library: lib,
});

const rearm = (state: CoreState, when: number) => reduce(state, { type: 'Rearm' }, depsAt(when));
const snooze = (state: CoreState, reminderId: string, when: number) =>
  reduce(state, { type: 'Response', reminderId, kind: 'Snooze' }, depsAt(when));
const done = (state: CoreState, reminderId: string, did: string[], when: number, lib?: readonly Exercise[]) =>
  reduce(state, { type: 'Response', reminderId, kind: 'Done', did }, depsAt(when, lib));

const chainOf = (result: CoreResult): ScheduledNotification[] => {
  const chains = result.intents.filter(
    (i): i is Extract<Intent, { type: 'ScheduleChain' }> => i.type === 'ScheduleChain',
  );
  expect(chains).toHaveLength(1);
  return chains[0].reminders;
};
const timesOf = (result: CoreResult): number[] => chainOf(result).map((n) => n.at);
const mondayTimesOf = (result: CoreResult): number[] => timesOf(result).filter((t) => t < local(TUE, '00:00'));
const dismiss = (reminderId: string): Intent => ({ type: 'DismissNotification', reminderId });

const reminderAt = (state: CoreState, firesAt: number): Reminder => {
  const found = state.reminders.find((r) => r.firesAt === firesAt);
  if (!found) throw new Error(`no Reminder at ${new Date(firesAt).toISOString()}`);
  return found;
};

/** Rearm at Mon 08:00 (the no-Response chain from 09:45), with SUGGESTION on the 09:45 Reminder. */
const morning = (): CoreState => {
  const state = rearm(start, at('08:00')).state;
  return {
    ...state,
    reminders: state.reminders.map((r) => (r.firesAt === at('09:45') ? { ...r, suggestion: SUGGESTION } : r)),
  };
};

describe('Done: the guided flow’s result becomes a Response', () => {
  it('records the Exercises marked Did it as text snapshots in Suggestion order, as a final Response', () => {
    const state = morning();
    const first = reminderAt(state, at('09:45'));
    const now = at('10:00');

    // Did it on the 3rd and 1st cards, given out of order; Not this one on the 2nd.
    const result = done(state, first.id, ['Wrist_Circles', 'Side_Neck_Stretch'], now);

    expect(reminderAt(result.state, at('09:45'))).toStrictEqual({
      ...first,
      status: 'done',
      done: [
        { id: 'Side_Neck_Stretch', name: 'Side Neck Stretch', bodyArea: 'Neck' },
        { id: 'Wrist_Circles', name: 'Wrist Circles', bodyArea: 'Wrists & Forearms' },
      ],
    });
    expect(result.state.lastResponseAt).toBe(now);
    expect(result.intents).toHaveLength(2);
    expect(result.intents).toContainEqual(dismiss(first.id));
    // 10:00 + 45 = 10:45, 11:30; the 10:30 fallback is gone.
    expect(timesOf(result).slice(0, 2)).toEqual([at('10:45'), at('11:30')]);
    // 10:45 + 9·45 = 17:30; 17:30 + 45 = 18:15 is past the window end.
    expect(mondayTimesOf(result).at(-1)).toBe(at('17:30'));
    expect(result.state.reminders.filter((r) => r.firesAt > now).map((r) => r.firesAt)).toEqual(timesOf(result));
  });

  it('counts as a Skip when every card was Not this one: skipped, with no list, still a final Response', () => {
    const state = morning();
    const first = reminderAt(state, at('09:45'));
    const now = at('10:00');

    const result = done(state, first.id, [], now);

    expect(reminderAt(result.state, at('09:45'))).toStrictEqual({ ...first, status: 'skipped' });
    expect(result.state.lastResponseAt).toBe(now);
    expect(result.intents).toHaveLength(2);
    expect(result.intents).toContainEqual(dismiss(first.id));
    expect(timesOf(result).slice(0, 2)).toEqual([at('10:45'), at('11:30')]);
  });

  it('ignores Ids not in the Suggestion and counts a duplicate once', () => {
    const state = morning();
    const first = reminderAt(state, at('09:45'));

    // Chest Squeeze is in the library but not in this Suggestion.
    const result = done(
      state,
      first.id,
      ['Bodyweight_Squat', 'Isometric_Chest_Squeezes', 'Bodyweight_Squat', 'No_Such_Exercise'],
      at('10:00'),
    );

    expect(reminderAt(result.state, at('09:45')).done).toStrictEqual([
      { id: 'Bodyweight_Squat', name: 'Bodyweight Squat', bodyArea: 'Hips & Legs' },
    ]);
  });

  it('counts as a Skip when none of the Ids is in the Suggestion', () => {
    const state = morning();
    const first = reminderAt(state, at('09:45'));
    const now = at('10:00');

    const result = done(state, first.id, ['Isometric_Chest_Squeezes', 'No_Such_Exercise'], now);

    expect(reminderAt(result.state, at('09:45'))).toStrictEqual({ ...first, status: 'skipped' });
    expect(result.state.lastResponseAt).toBe(now);
    expect(result.intents).toContainEqual(dismiss(first.id));
  });

  it('copies the snapshot from the Suggestion, not from the library', () => {
    const state = morning();
    const first = reminderAt(state, at('09:45'));
    // The library has changed since the Suggestion was made: renamed, moved to another Body Area.
    const changed = library.map((e) => ({ ...e, name: `${e.name} (renamed)`, bodyArea: 'Core & Lower Back' as const }));

    const withChanged = done(state, first.id, ['Side_Neck_Stretch'], at('10:00'), changed);
    const withEmpty = done(state, first.id, ['Side_Neck_Stretch'], at('10:00'), []);

    const snapshot = [{ id: 'Side_Neck_Stretch', name: 'Side Neck Stretch', bodyArea: 'Neck' }];
    expect(reminderAt(withChanged.state, at('09:45')).done).toStrictEqual(snapshot);
    expect(reminderAt(withEmpty.state, at('09:45')).done).toStrictEqual(snapshot);
  });
});

describe('Done: late and guarded', () => {
  it('accepts a late Done on the outstanding Reminder before a later one fires', () => {
    const state = morning();
    const first = reminderAt(state, at('09:45'));

    // 10:29 is just before the 10:30 Reminder fires.
    const result = done(state, first.id, ['Bodyweight_Squat'], at('10:29'));

    expect(reminderAt(result.state, at('09:45')).status).toBe('done');
    expect(result.state.lastResponseAt).toBe(at('10:29'));
  });

  it('ignores a Done on a Reminder that a later fired one superseded (Missed), returning the state unchanged', () => {
    const state = morning();
    const stale = reminderAt(state, at('09:45'));

    // The 10:30 Reminder has fired: 09:45 is Missed.
    const result = done(state, stale.id, ['Bodyweight_Squat'], at('10:35'));

    expect(result.state).toBe(state);
    expect(result.intents).toEqual([dismiss(stale.id)]);
  });

  it('ignores a second Done on the same Reminder, returning the state unchanged', () => {
    const first = reminderAt(morning(), at('09:45'));
    const once = done(morning(), first.id, ['Bodyweight_Squat'], at('10:00')).state;

    const result = done(once, first.id, ['Side_Neck_Stretch'], at('10:01'));

    expect(result.state).toBe(once);
    expect(result.intents).toEqual([dismiss(first.id)]);
  });
});

describe('early Start: a Done before the Snooze re-fire counts and cancels it', () => {
  it('accepts a Done while the re-fire is pending, clearing the re-fire and rebuilding the chain from the Done', () => {
    const first = reminderAt(morning(), at('09:45'));
    const once = snooze(morning(), first.id, at('10:00')).state;
    const now = at('10:05');

    // The re-fire is at 10:10; Done at 10:05, before it.
    const result = done(once, first.id, ['Side_Neck_Stretch'], now);

    // The re-fire is cancelled; the Snooze still counts.
    expect(reminderAt(result.state, at('09:45'))).toStrictEqual({
      ...first,
      snoozes: 1,
      status: 'done',
      done: [{ id: 'Side_Neck_Stretch', name: 'Side Neck Stretch', bodyArea: 'Neck' }],
    });
    expect(result.state.lastResponseAt).toBe(now);
    expect(result.intents).toHaveLength(2);
    expect(result.intents).toContainEqual(dismiss(first.id));
    // No re-fire notification is scheduled any more.
    expect(chainOf(result).map((n) => n.reminderId)).not.toContain(first.id);
    // 10:05 + 45 = 10:50, 11:35; the 10:10 re-fire and the 10:55 fallback are gone.
    expect(timesOf(result).slice(0, 2)).toEqual([at('10:50'), at('11:35')]);
  });

  it('keeps the snoozed Reminder outstanding while its re-fire is pending', () => {
    const first = reminderAt(morning(), at('09:45'));
    const once = snooze(morning(), first.id, at('10:00')).state;

    // The re-fire is at 10:10.
    expect(outstandingReminder(once, at('10:05'))?.id).toBe(first.id);
  });
});

describe('Suggestion: exercisesPerSuggestion distinct Exercises', () => {
  it('gives every Reminder that many distinct Exercises from the library, each a text snapshot with its Body Area', () => {
    const snapshots = library.map(({ id, name, dose, cue, bodyArea }) => ({ id, name, dose, cue, bodyArea }));

    const result = rearm(start, at('08:00'));

    expect(result.state.reminders.length).toBeGreaterThan(0);
    for (const reminder of result.state.reminders) {
      expect(reminder.suggestion).toHaveLength(3);
      expect(new Set(reminder.suggestion.map((e) => e.id)).size).toBe(3);
      for (const e of reminder.suggestion) expect(snapshots).toContainEqual(e);
    }
  });
});
