import { describe, expect, it } from 'vitest';
import {
  guidedStart,
  initialState,
  type CoreState,
  type DoneExercise,
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
];
const NECK: DoneExercise = { id: 'Side_Neck_Stretch', name: 'Side Neck Stretch', bodyArea: 'Neck' };

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

/** Start tapped on the 10:30 Reminder; one Done earlier, the chain ahead. */
const STARTED = idAt(MON, '10:30');
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

describe('guidedStart: the Reminder the guided screen opens on', () => {
  it('the outstanding Reminder: it', () => {
    expect(guidedStart(withStarted('scheduled'), STARTED, DURING)).toEqual(reminder(MON, '10:30', 'scheduled'));
  });

  it('replaced by a newer Reminder while still stored scheduled: it, settled as Missed', () => {
    expect(guidedStart(withStarted('scheduled'), STARTED, AFTER_NEWER)).toEqual(reminder(MON, '10:30', 'missed'));
  });

  it('dropped at closing: it', () => {
    // Snoozed twice; its 18:00 re-fire was past closing, so it settled as dropped.
    const dropped = reminder(MON, '17:15', 'dropped', { snoozes: 2, refiresAt: local(MON, '18:00') });
    const state = inMadrid(LAST_RESPONSE, dropped, reminder(TUE, '09:45', 'scheduled'));

    expect(guidedStart(state, idAt(MON, '17:15'), local(MON, '19:00'))).toEqual(dropped);
  });

  it('already Done: undefined', () => {
    expect(guidedStart(withStarted('done'), STARTED, DURING)).toBeUndefined();
  });

  it('already skipped: undefined', () => {
    expect(guidedStart(withStarted('skipped'), STARTED, DURING)).toBeUndefined();
  });

  it("a Missed Reminder from yesterday: undefined", () => {
    const state = inMadrid(
      LAST_RESPONSE,
      reminder(MON, '10:30', 'missed'),
      reminder(TUE, '09:45', 'scheduled'),
      reminder(TUE, '10:30', 'scheduled'),
    );

    expect(guidedStart(state, idAt(MON, '10:30'), local(TUE, '09:50'))).toBeUndefined();
  });

  it('an unknown Reminder, or one not yet fired: undefined', () => {
    const state = withStarted('scheduled');

    expect(guidedStart(state, 'reminder-0', AFTER_NEWER)).toBeUndefined();
    expect(guidedStart(state, idAt(MON, '12:00'), AFTER_NEWER)).toBeUndefined();
  });
});
