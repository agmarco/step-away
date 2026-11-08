import { describe, expect, it } from 'vitest';
import {
  initialState,
  isGoalDay,
  reduce,
  seededRandom,
  streak,
  todayTally,
  type CoreDeps,
  type CoreEvent,
  type CoreState,
  type DoneExercise,
  type LocalDate,
  type Reminder,
  type SuggestedExercise,
} from './index';

// Local times are Europe/Madrid in October/November 2026: CET, UTC+1. 2 November 2026 is a Monday.
// Default Settings: Mon-Fri 09:00-18:00, weekends without Active Hours, Daily Goal 4.
const ZONE = 'Europe/Madrid';
const local = (date: string, time: string): number => Date.parse(`${date}T${time}:00+01:00`);
const FRI_BEFORE = '2026-10-30';
const MON = '2026-11-02';
const TUE = '2026-11-03';
const MONDAY: LocalDate = { year: 2026, month: 11, day: 2 };

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
const NECK: DoneExercise = { id: 'Side_Neck_Stretch', name: 'Side Neck Stretch', bodyArea: 'Neck' };
const SQUAT: DoneExercise = { id: 'Bodyweight_Squat', name: 'Bodyweight Squat', bodyArea: 'Hips & Legs' };
const WRIST: DoneExercise = { id: 'Wrist_Circles', name: 'Wrist Circles', bodyArea: 'Wrists & Forearms' };

const reminder = (day: string, time: string, status: Reminder['status'], extra: Partial<Reminder> = {}): Reminder => ({
  id: `reminder-${local(day, time)}`,
  firesAt: local(day, time),
  suggestion: SUGGESTION,
  status,
  ...(status === 'done' && { done: [NECK] }),
  ...extra,
});
const idAt = (day: string, time: string) => `reminder-${local(day, time)}`;

const inMadrid = (lastResponseAt: number, ...reminders: Reminder[]): CoreState => ({
  ...initialState,
  settings: { ...initialState.settings, timeZone: ZONE },
  lastAppOpenAt: lastResponseAt,
  lastResponseAt,
  reminders,
});

/**
 * Monday evening, after closing: last Friday a Goal Day (4 Done); today 2
 * Done, a Skip, a Missed and a dropped one; Tuesday's chain ahead.
 */
const evening = inMadrid(
  local(MON, '11:20'),
  reminder(FRI_BEFORE, '09:45', 'done'),
  reminder(FRI_BEFORE, '10:30', 'done'),
  reminder(FRI_BEFORE, '11:15', 'done'),
  reminder(FRI_BEFORE, '12:00', 'done'),
  reminder(MON, '09:45', 'done', { done: [NECK, SQUAT] }),
  reminder(MON, '10:30', 'skipped'),
  reminder(MON, '11:15', 'done'),
  reminder(MON, '12:00', 'missed'),
  // Snoozed at 17:15 (re-fired 17:25) and at 17:50: the 18:00 re-fire was past closing.
  reminder(MON, '17:15', 'dropped', { snoozes: 2, refiresAt: local(MON, '18:00') }),
  reminder(TUE, '09:45', 'scheduled'),
  reminder(TUE, '10:30', 'scheduled'),
);
const EVENING = local(MON, '20:00');

/** Monday afternoon: one Done, the outstanding 13:30 Reminder and the chain ahead. */
const afternoon = inMadrid(
  local(MON, '10:00'),
  reminder(MON, '09:45', 'done'),
  reminder(MON, '13:30', 'scheduled'),
  reminder(MON, '14:15', 'scheduled'),
  reminder(MON, '15:00', 'scheduled'),
);
const AFTERNOON = local(MON, '14:00');

const depsAt = (when: number): CoreDeps => ({ clock: { now: () => when }, random: seededRandom(7), library: [] });
const correct = (state: CoreState, event: Omit<Extract<CoreEvent, { type: 'Correct' }>, 'type'>, when: number) =>
  reduce(state, { type: 'Correct', ...event }, depsAt(when));

/** `state` with only `corrected` replaced (by Id): everything else, the chain ahead included, as it was. */
const withCorrected = (state: CoreState, corrected: Reminder): CoreState => ({
  ...state,
  reminders: state.reminders.map((r) => (r.id === corrected.id ? corrected : r)),
});
const find = (state: CoreState, id: string): Reminder => {
  const found = state.reminders.find((r) => r.id === id);
  if (!found) throw new Error(`no Reminder ${id}`);
  return found;
};

describe("Correct: changing the outcome of one of today's Reminders", () => {
  it('Done to Skip: skipped, its done list removed; nothing else changes and there are no intents', () => {
    const { done: _removed, ...rest } = find(evening, idAt(MON, '09:45'));

    const result = correct(evening, { reminderId: idAt(MON, '09:45'), to: 'Skip' }, EVENING);

    expect(result).toStrictEqual({ state: withCorrected(evening, { ...rest, status: 'skipped' }), intents: [] });
  });

  it('Done to Missed: missed, its done list removed', () => {
    const { done: _removed, ...rest } = find(evening, idAt(MON, '11:15'));

    const result = correct(evening, { reminderId: idAt(MON, '11:15'), to: 'Missed' }, EVENING);

    expect(result).toStrictEqual({ state: withCorrected(evening, { ...rest, status: 'missed' }), intents: [] });
  });

  it('Skip to Done: records the Ids in the Suggestion, once each, in Suggestion order, as snapshots', () => {
    const skipped = find(evening, idAt(MON, '10:30'));

    const result = correct(
      evening,
      { reminderId: skipped.id, to: 'Done', did: ['Wrist_Circles', 'Side_Neck_Stretch', 'No_Such_Exercise', 'Wrist_Circles'] },
      EVENING,
    );

    expect(result).toStrictEqual({
      state: withCorrected(evening, { ...skipped, status: 'done', done: [NECK, WRIST] }),
      intents: [],
    });
  });

  it('Missed to Done', () => {
    const missed = find(evening, idAt(MON, '12:00'));

    const result = correct(evening, { reminderId: missed.id, to: 'Done', did: ['Bodyweight_Squat'] }, EVENING);

    expect(result).toStrictEqual({ state: withCorrected(evening, { ...missed, status: 'done', done: [SQUAT] }), intents: [] });
  });

  it('Done to Done with a different list replaces the list', () => {
    const doneOne = find(evening, idAt(MON, '11:15'));

    const result = correct(
      evening,
      { reminderId: doneOne.id, to: 'Done', did: ['Wrist_Circles', 'Bodyweight_Squat'] },
      EVENING,
    );

    expect(result).toStrictEqual({
      state: withCorrected(evening, { ...doneOne, status: 'done', done: [SQUAT, WRIST] }),
      intents: [],
    });
  });

  it('Dropped to Skip: skipped, its Snooze count and re-fire kept', () => {
    const dropped = find(evening, idAt(MON, '17:15'));

    const result = correct(evening, { reminderId: dropped.id, to: 'Skip' }, EVENING);

    expect(result).toStrictEqual({ state: withCorrected(evening, { ...dropped, status: 'skipped' }), intents: [] });
    expect(find(result.state, dropped.id).snoozes).toBe(2);
  });

  it('while another Reminder is outstanding, leaves it, the chain ahead and lastResponseAt as they are', () => {
    const doneOne = find(afternoon, idAt(MON, '09:45'));
    const { done: _removed, ...rest } = doneOne;

    const result = correct(afternoon, { reminderId: doneOne.id, to: 'Skip' }, AFTERNOON);

    expect(result).toStrictEqual({ state: withCorrected(afternoon, { ...rest, status: 'skipped' }), intents: [] });
    expect(result.state.lastResponseAt).toBe(local(MON, '10:00'));
  });

  it("changes today's Goal Day, Streak and tally", () => {
    expect(todayTally(evening, EVENING)).toEqual({ done: 2, skipped: 1, missed: 1, exercises: 3 });
    expect(isGoalDay(evening, MONDAY)).toBe(false);
    // Monday not a Goal Day yet: (Sunday, Saturday skipped) Friday; Thursday 29 October ends it.
    expect(streak(evening, EVENING)).toBe(1);

    const one = correct(evening, { reminderId: idAt(MON, '10:30'), to: 'Done', did: ['Wrist_Circles'] }, EVENING).state;
    const reached = correct(one, { reminderId: idAt(MON, '12:00'), to: 'Done', did: ['Bodyweight_Squat'] }, EVENING).state;

    expect(todayTally(reached, EVENING)).toEqual({ done: 4, skipped: 0, missed: 0, exercises: 5 });
    expect(isGoalDay(reached, MONDAY)).toBe(true);
    expect(streak(reached, EVENING)).toBe(2);

    const undone = correct(reached, { reminderId: idAt(MON, '09:45'), to: 'Skip' }, EVENING).state;

    expect(todayTally(undone, EVENING)).toEqual({ done: 3, skipped: 1, missed: 0, exercises: 3 });
    expect(isGoalDay(undone, MONDAY)).toBe(false);
    expect(streak(undone, EVENING)).toBe(1);
  });
});

describe('Correct: rejected, returning the same state object and no intents', () => {
  const rejected = (state: CoreState, event: Parameters<typeof correct>[1], when: number) => {
    const result = correct(state, event, when);
    expect(result.state).toBe(state);
    expect(result.intents).toEqual([]);
  };

  it('a Done with no Id left from the Suggestion', () => {
    rejected(evening, { reminderId: idAt(MON, '10:30'), to: 'Done', did: [] }, EVENING);
    rejected(evening, { reminderId: idAt(MON, '10:30'), to: 'Done', did: ['No_Such_Exercise'] }, EVENING);
    rejected(evening, { reminderId: idAt(MON, '10:30'), to: 'Done' }, EVENING);
  });

  it('a Reminder of a past day', () => {
    rejected(evening, { reminderId: idAt(FRI_BEFORE, '09:45'), to: 'Skip' }, EVENING);
  });

  it("yesterday's Reminder just after midnight", () => {
    // Monday 17:15 is yesterday at Tuesday 00:05.
    rejected(evening, { reminderId: idAt(MON, '17:15'), to: 'Skip' }, local(TUE, '00:05'));
  });

  it('the outstanding Reminder (it gets Start instead)', () => {
    rejected(afternoon, { reminderId: idAt(MON, '13:30'), to: 'Done', did: ['Side_Neck_Stretch'] }, AFTERNOON);
    rejected(afternoon, { reminderId: idAt(MON, '13:30'), to: 'Skip' }, AFTERNOON);
  });

  it('a Reminder that has not fired yet', () => {
    rejected(afternoon, { reminderId: idAt(MON, '14:15'), to: 'Missed' }, AFTERNOON);
  });

  it('an unknown Id', () => {
    rejected(evening, { reminderId: 'reminder-0', to: 'Skip' }, EVENING);
    rejected(evening, { reminderId: 'not-a-reminder', to: 'Done', did: ['Side_Neck_Stretch'] }, EVENING);
  });
});

describe('Correct: settles first', () => {
  it('accepts a fired Reminder still scheduled that settles as Missed today (superseded, not yet persisted)', () => {
    // At 14:20 the 14:15 Reminder has fired, so the 13:30 one is Missed on replacement.
    const when = local(MON, '14:20');
    const superseded = find(afternoon, idAt(MON, '13:30'));

    const result = correct(afternoon, { reminderId: superseded.id, to: 'Done', did: ['Side_Neck_Stretch'] }, when);

    expect(result).toStrictEqual({
      state: withCorrected(afternoon, { ...superseded, status: 'done', done: [NECK] }),
      intents: [],
    });
    expect(todayTally(result.state, when)).toEqual({ done: 2, skipped: 0, missed: 0, exercises: 2 });
  });
});
