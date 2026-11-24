import { describe, expect, it } from 'vitest';
import {
  guidedFinish,
  initialState,
  outstandingReminder,
  reduce,
  seededRandom,
  type CoreDeps,
  type CoreState,
  type DoneExercise,
  type GuidedFinishEvent,
  type Reminder,
  type SuggestedExercise,
} from './index';

// Local times are Europe/Madrid in November 2026: CET, UTC+1. 2 November 2026 is a Monday.
// Default Settings: Mon-Fri 09:00-18:00, 45-minute Interval.
const ZONE = 'Europe/Madrid';
const local = (date: string, time: string): number => Date.parse(`${date}T${time}:00+01:00`);
const MON = '2026-11-02';
const TUE = '2026-11-03';

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

const depsAt = (when: number): CoreDeps => ({ clock: { now: () => when }, random: seededRandom(7), library: [] });
const find = (state: CoreState, id: string): Reminder => {
  const found = state.reminders.find((r) => r.id === id);
  if (!found) throw new Error(`no Reminder ${id}`);
  return found;
};
/** Feeds the guided finish's event into the core, as the handler will. */
const apply = (state: CoreState, event: GuidedFinishEvent | null, when: number) => {
  if (!event) throw new Error('expected an event');
  return reduce(state, event, depsAt(when));
};

/** The guided screen started on the 10:30 Reminder; one Done earlier, the chain ahead. */
const STARTED = idAt(MON, '10:30');
const NEWER = idAt(MON, '11:15');
const LAST_RESPONSE = local(MON, '10:00');
const withStarted = (status: Reminder['status'], extra: Partial<Reminder> = {}): CoreState =>
  inMadrid(
    LAST_RESPONSE,
    reminder(MON, '09:45', 'done'),
    reminder(MON, '10:30', status, extra),
    reminder(MON, '11:15', 'scheduled'),
    reminder(MON, '12:00', 'scheduled'),
  );
/** Before 11:15 fires: 10:30 is still the latest fired Reminder. */
const DURING = local(MON, '10:40');
/** After 11:15 fired: the 10:30 Reminder settles to Missed, 11:15 is outstanding. */
const AFTER_NEWER = local(MON, '11:20');

describe('guidedFinish: what finishing the guided screen records', () => {
  it('on the outstanding Reminder with a Did it: the Done Response', () => {
    const state = withStarted('scheduled');

    expect(guidedFinish(state, STARTED, ['Bodyweight_Squat'], DURING)).toEqual({
      type: 'Response',
      reminderId: STARTED,
      kind: 'Done',
      did: ['Bodyweight_Squat'],
    });
  });

  it('on the outstanding Reminder with no Did its (End here, or all Not this one): a Done Response the core records as a Skip', () => {
    const state = withStarted('scheduled');

    const event = guidedFinish(state, STARTED, [], DURING);

    expect(event).toEqual({ type: 'Response', reminderId: STARTED, kind: 'Done', did: [] });
    expect(find(apply(state, event, DURING).state, STARTED).status).toBe('skipped');
  });

  it('replaced by a newer Reminder: a correction to Done; the newer one stays outstanding and the chain is unchanged', () => {
    // Persisted before settling: the 10:30 Reminder is still `scheduled` in state.
    const state = withStarted('scheduled');

    const event = guidedFinish(state, STARTED, ['Bodyweight_Squat', 'Side_Neck_Stretch'], AFTER_NEWER);

    expect(event).toEqual({
      type: 'Correct',
      reminderId: STARTED,
      to: 'Done',
      did: ['Bodyweight_Squat', 'Side_Neck_Stretch'],
    });
    const result = apply(state, event, AFTER_NEWER);
    // A late finish celebrates like a normal one (#28): the fixture held no Badge, so done-1 unlocks now.
    expect(result.intents).toEqual([
      { type: 'BadgesUnlocked', badges: ['done-1'] },
      { type: 'CelebrationDue', reminderId: STARTED, goalReached: false, badges: ['done-1'] },
    ]);
    expect(result.state).toStrictEqual({
      ...inMadrid(
        LAST_RESPONSE,
        reminder(MON, '09:45', 'done'),
        reminder(MON, '10:30', 'done', { done: [NECK, SQUAT] }),
        reminder(MON, '11:15', 'scheduled'),
        reminder(MON, '12:00', 'scheduled'),
      ),
      badges: [{ id: 'done-1', unlockedAt: AFTER_NEWER }],
    });
    expect(outstandingReminder(result.state, AFTER_NEWER)?.id).toBe(NEWER);
  });

  it('answered Skip from the shade meanwhile, finished with a Did it: a correction to Done (a finish with a Did it wins)', () => {
    const state = withStarted('skipped');

    const event = guidedFinish(state, STARTED, ['Side_Neck_Stretch'], DURING);

    expect(event).toEqual({ type: 'Correct', reminderId: STARTED, to: 'Done', did: ['Side_Neck_Stretch'] });
    expect(find(apply(state, event, DURING).state, STARTED)).toMatchObject({ status: 'done', done: [NECK] });
  });

  it('already Done, finished with no Did its: nothing is recorded (never overwrites a Done)', () => {
    expect(guidedFinish(withStarted('done'), STARTED, [], DURING)).toBeNull();
  });

  it('already skipped, finished with no Did its: nothing is recorded', () => {
    expect(guidedFinish(withStarted('skipped'), STARTED, [], DURING)).toBeNull();
  });

  it('replaced by a newer Reminder, finished with no Did its: a correction to Skip', () => {
    const state = withStarted('scheduled');

    const event = guidedFinish(state, STARTED, [], AFTER_NEWER);

    expect(event).toEqual({ type: 'Correct', reminderId: STARTED, to: 'Skip' });
    const result = apply(state, event, AFTER_NEWER);
    expect(find(result.state, STARTED).status).toBe('skipped');
    expect(outstandingReminder(result.state, AFTER_NEWER)?.id).toBe(NEWER);
  });

  it('Ids outside the Suggestion are not Did its: Missed becomes a correction to Skip', () => {
    const state = withStarted('missed');

    expect(guidedFinish(state, STARTED, ['No_Such_Exercise'], AFTER_NEWER)).toEqual({
      type: 'Correct',
      reminderId: STARTED,
      to: 'Skip',
    });
  });

  it('dropped at closing, finished with no Did its: a correction to Skip', () => {
    // Snoozed twice; its 18:00 re-fire was past closing, so it settled as dropped.
    const state = inMadrid(
      LAST_RESPONSE,
      reminder(MON, '17:15', 'dropped', { snoozes: 2, refiresAt: local(MON, '18:00') }),
      reminder(TUE, '09:45', 'scheduled'),
    );

    expect(guidedFinish(state, idAt(MON, '17:15'), [], local(MON, '19:00'))).toEqual({
      type: 'Correct',
      reminderId: idAt(MON, '17:15'),
      to: 'Skip',
    });
  });

  it("a Reminder from yesterday: nothing is recorded, even with a Did it", () => {
    const state = inMadrid(
      LAST_RESPONSE,
      reminder(MON, '10:30', 'missed'),
      reminder(TUE, '09:45', 'scheduled'),
      reminder(TUE, '10:30', 'scheduled'),
    );

    expect(guidedFinish(state, idAt(MON, '10:30'), ['Side_Neck_Stretch'], local(TUE, '09:50'))).toBeNull();
  });

  it('an unknown Reminder, or one not yet fired: nothing is recorded', () => {
    const state = withStarted('scheduled');

    expect(guidedFinish(state, 'reminder-0', ['Side_Neck_Stretch'], AFTER_NEWER)).toBeNull();
    expect(guidedFinish(state, idAt(MON, '12:00'), ['Side_Neck_Stretch'], AFTER_NEWER)).toBeNull();
  });
});
