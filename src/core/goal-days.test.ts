import { describe, expect, it } from 'vitest';
import {
  dailyGoalFor,
  dayTally,
  initialState,
  isGoalDay,
  reduce,
  seededRandom,
  streak,
  todayTally,
  weekMarks,
  type CoreDeps,
  type CoreState,
  type LocalDate,
  type Reminder,
  type SuggestedExercise,
} from './index';

// Local times are Europe/Madrid in October/November 2026: CET, UTC+1 (DST ended
// on 25 October). 2 November 2026 is a Monday.
// Default Settings: Mon-Fri 09:00-18:00, weekends without Active Hours.
const ZONE = 'Europe/Madrid';
const local = (date: string, time: string): number => Date.parse(`${date}T${time}:00+01:00`);
const date = (iso: string): LocalDate => {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
};

const FRI_BEFORE = '2026-10-30';
const MON = '2026-11-02';
const TUE = '2026-11-03';
const WED = '2026-11-04';
const THU = '2026-11-05';
const FRI = '2026-11-06';
const SAT = '2026-11-07';
const SUN = '2026-11-08';
const NEXT_MON = '2026-11-09';
const NEXT_TUE = '2026-11-10';

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
const NECK = { id: 'Side_Neck_Stretch', name: 'Side Neck Stretch', bodyArea: 'Neck' } as const;
const SQUAT = { id: 'Bodyweight_Squat', name: 'Bodyweight Squat', bodyArea: 'Hips & Legs' } as const;

/** A Reminder of `day` at `time`; a Done one did the Side Neck Stretch unless `extra` says otherwise. */
const reminder = (day: string, time: string, status: Reminder['status'], extra: Partial<Reminder> = {}): Reminder => ({
  id: `reminder-${local(day, time)}`,
  firesAt: local(day, time),
  suggestion: SUGGESTION,
  status,
  ...(status === 'done' && { done: [NECK] }),
  ...extra,
});

// The no-Response chain of a weekday: 09:45 + k·45.
const TIMES = ['09:45', '10:30', '11:15', '12:00', '12:45', '13:30', '14:15', '15:00'];
/** `count` Done Reminders on `day`, from 09:45 one Interval apart. */
const doneOn = (day: string, count: number): Reminder[] => TIMES.slice(0, count).map((t) => reminder(day, t, 'done'));

const inZone = (reminders: Reminder[], timeZone = ZONE): CoreState => ({
  ...initialState,
  settings: { ...initialState.settings, timeZone },
  reminders: [...reminders].sort((a, b) => a.firesAt - b.firesAt),
});

const depsAt = (when: number): CoreDeps => ({ clock: { now: () => when }, random: seededRandom(7), library: [] });
const setDailyGoal = (state: CoreState, goal: number, when: number) =>
  reduce(state, { type: 'SetDailyGoal', goal }, depsAt(when));

const noTally = { done: 0, skipped: 0, missed: 0, exercises: 0 };

describe('Days: a Reminder belongs to the local date of its first fire', () => {
  it('counts a Reminder at 23:58 on its own day, though answered after midnight', () => {
    // Fourth Done of Monday, given at 00:05 on Tuesday.
    const state = {
      ...inZone([...doneOn(MON, 3), reminder(MON, '23:58', 'done')]),
      lastResponseAt: local(TUE, '00:05'),
    };

    expect(dayTally(state, date(MON))).toEqual({ done: 4, skipped: 0, missed: 0, exercises: 4 });
    expect(isGoalDay(state, date(MON))).toBe(true);
    expect(dayTally(state, date(TUE))).toEqual(noTally);
    expect(todayTally(state, local(TUE, '00:10'))).toEqual(noTally);
  });

  it('keeps a snoozed Reminder on the day it first fired when its re-fire lands after midnight', () => {
    const state = inZone([
      reminder(MON, '23:50', 'done', { snoozes: 1, refiresAt: local(TUE, '00:00') }),
      reminder(MON, '23:58', 'skipped', { snoozes: 1, refiresAt: local(TUE, '00:08') }),
    ]);

    expect(dayTally(state, date(MON))).toEqual({ done: 1, skipped: 1, missed: 0, exercises: 1 });
    expect(dayTally(state, date(TUE))).toEqual(noTally);
  });

  it("reads the day in the Settings' time zone, not in UTC", () => {
    // 00:30 on Tuesday in Madrid is 23:30 UTC on Monday.
    const madrid = inZone([reminder(TUE, '00:30', 'done')]);
    expect(dayTally(madrid, date(TUE))).toEqual({ done: 1, skipped: 0, missed: 0, exercises: 1 });
    expect(dayTally(madrid, date(MON))).toEqual(noTally);

    // 20:00 on Monday in New York (EST, UTC-5) is 01:00 UTC on Tuesday.
    const newYork = inZone(
      [{ ...reminder(MON, '09:45', 'done'), id: 'ny', firesAt: Date.parse('2026-11-02T20:00:00-05:00') }],
      'America/New_York',
    );
    expect(dayTally(newYork, date(MON))).toEqual({ done: 1, skipped: 0, missed: 0, exercises: 1 });
    expect(dayTally(newYork, date(TUE))).toEqual(noTally);
  });
});

describe('Daily Goal', () => {
  it('is 4 with no change recorded', () => {
    const state = inZone([]);
    expect(dailyGoalFor(state, date(MON))).toBe(4);
    expect(dailyGoalFor(state, date('2020-01-01'))).toBe(4);
  });

  it('changed mid-day applies from tomorrow: today keeps its goal and its Goal Day judgement', () => {
    const monday = inZone(doneOn(MON, 3));
    expect(isGoalDay(monday, date(MON))).toBe(false);

    const result = setDailyGoal(monday, 3, local(MON, '12:30'));

    expect(result.state.goalChanges).toEqual([{ from: date(TUE), goal: 3 }]);
    expect(result.intents).toEqual([]);
    expect(dailyGoalFor(result.state, date(MON))).toBe(4);
    expect(isGoalDay(result.state, date(MON))).toBe(false);
    expect(dailyGoalFor(result.state, date(TUE))).toBe(3);
    expect(dailyGoalFor(result.state, date(NEXT_MON))).toBe(3);

    const tuesday = { ...result.state, reminders: [...result.state.reminders, ...doneOn(TUE, 3)] };
    expect(isGoalDay(tuesday, date(TUE))).toBe(true);
  });

  it("takes tomorrow in the Settings' time zone", () => {
    // 00:30 on Monday in Madrid is 23:30 UTC on Sunday: tomorrow is Tuesday, not Monday.
    const result = setDailyGoal(inZone([]), 2, local(MON, '00:30'));
    expect(result.state.goalChanges).toEqual([{ from: date(TUE), goal: 2 }]);
  });

  it('a second change before tomorrow replaces the first', () => {
    const first = setDailyGoal(inZone([]), 3, local(MON, '12:30')).state;
    const second = setDailyGoal(first, 6, local(MON, '17:00')).state;

    expect(second.goalChanges).toEqual([{ from: date(TUE), goal: 6 }]);
    expect(dailyGoalFor(second, date(MON))).toBe(4);
    expect(dailyGoalFor(second, date(TUE))).toBe(6);
  });

  it('days long past keep the goal they started with', () => {
    const first = setDailyGoal(inZone([]), 2, local(MON, '12:30')).state;
    const second = setDailyGoal(first, 5, local(THU, '12:30')).state;

    expect(second.goalChanges).toEqual([
      { from: date(TUE), goal: 2 },
      { from: date(FRI), goal: 5 },
    ]);
    expect(dailyGoalFor(second, date(FRI_BEFORE))).toBe(4);
    expect(dailyGoalFor(second, date(MON))).toBe(4);
    expect(dailyGoalFor(second, date(TUE))).toBe(2);
    expect(dailyGoalFor(second, date(THU))).toBe(2);
    expect(dailyGoalFor(second, date(FRI))).toBe(5);
    expect(dailyGoalFor(second, date(NEXT_MON))).toBe(5);
  });

  it('judges each day of a Streak against its own goal', () => {
    // Monday: 3 Done against 4. From Tuesday the goal is 3.
    const lowered = setDailyGoal(inZone(doneOn(MON, 3)), 3, local(MON, '12:30')).state;
    const state = { ...lowered, reminders: [...lowered.reminders, ...doneOn(TUE, 3), ...doneOn(WED, 3)] };

    expect(isGoalDay(state, date(MON))).toBe(false);
    expect(isGoalDay(state, date(TUE))).toBe(true);
    expect(isGoalDay(state, date(WED))).toBe(true);
    // Thursday not a Goal Day yet: Wednesday, Tuesday; Monday ends it.
    expect(streak(state, local(THU, '10:00'))).toBe(2);
  });
});

describe('Goal Day', () => {
  it('counts only Done Reminders against the goal', () => {
    const almost = inZone([
      ...doneOn(MON, 3),
      reminder(MON, '12:45', 'skipped'),
      reminder(MON, '13:30', 'missed'),
      reminder(MON, '14:15', 'dropped', { snoozes: 2, refiresAt: local(MON, '18:00') }),
      reminder(MON, '15:00', 'skipped'),
    ]);
    expect(isGoalDay(almost, date(MON))).toBe(false);

    expect(isGoalDay(inZone(doneOn(MON, 4)), date(MON))).toBe(true);
    expect(isGoalDay(inZone(doneOn(MON, 5)), date(MON))).toBe(true);
    expect(isGoalDay(inZone([]), date(MON))).toBe(false);
  });
});

describe('Streak', () => {
  it('continues across a weekend without Active Hours', () => {
    const state = inZone([
      ...doneOn(WED, 3),
      ...doneOn(THU, 4),
      ...doneOn(FRI, 4),
      ...doneOn(NEXT_MON, 4),
      ...doneOn(NEXT_TUE, 1),
    ]);
    // Tuesday not a Goal Day yet: Monday, (Sunday, Saturday skipped), Friday, Thursday; Wednesday ends it.
    expect(streak(state, local(NEXT_TUE, '10:00'))).toBe(3);
  });

  it('is not broken by a today that is not a Goal Day yet', () => {
    const state = inZone([...doneOn(FRI, 4), ...doneOn(NEXT_MON, 4)]);
    expect(streak(state, local(NEXT_TUE, '08:00'))).toBe(2);
  });

  it('is ended by a weekday with Active Hours that is not a Goal Day', () => {
    const state = inZone([...doneOn(THU, 4), ...doneOn(FRI, 2), ...doneOn(NEXT_MON, 4)]);
    expect(streak(state, local(NEXT_TUE, '10:00'))).toBe(1);
  });

  it('counts today once it is a Goal Day', () => {
    const before = inZone([...doneOn(FRI, 4), ...doneOn(NEXT_MON, 4), ...doneOn(NEXT_TUE, 3)]);
    expect(streak(before, local(NEXT_TUE, '12:30'))).toBe(2);

    const after = inZone([...doneOn(FRI, 4), ...doneOn(NEXT_MON, 4), ...doneOn(NEXT_TUE, 4)]);
    expect(streak(after, local(NEXT_TUE, '12:30'))).toBe(3);
  });

  it('is 0 with no Goal Day', () => {
    expect(streak(inZone([]), local(MON, '10:00'))).toBe(0);
    expect(streak(inZone(doneOn(FRI_BEFORE, 3)), local(MON, '10:00'))).toBe(0);
  });

  it('skips the weekdays the current Settings give no Active Hours', () => {
    const base = inZone([...doneOn(MON, 4), ...doneOn(TUE, 4), ...doneOn(THU, 4)]);
    const state = { ...base, settings: { ...base.settings, activeHours: { ...base.settings.activeHours, wed: null } } };
    // Friday not a Goal Day yet: Thursday, (Wednesday skipped), Tuesday, Monday; Friday 30 October ends it.
    expect(streak(state, local(FRI, '10:00'))).toBe(3);
  });
});

describe("Today's tally", () => {
  it('counts Done, skipped and Missed, and the Exercises in the Done lists; not dropped or scheduled', () => {
    const state = inZone([
      reminder(FRI_BEFORE, '17:15', 'done'),
      reminder(MON, '09:45', 'done', { done: [NECK, SQUAT] }),
      reminder(MON, '10:30', 'skipped'),
      reminder(MON, '11:15', 'missed'),
      reminder(MON, '12:00', 'done', { done: [SQUAT] }),
      reminder(MON, '12:45', 'dropped', { snoozes: 2, refiresAt: local(MON, '18:00') }),
      reminder(MON, '13:30', 'done'),
      // The outstanding one, and one ahead.
      reminder(MON, '15:45', 'scheduled'),
      reminder(MON, '16:30', 'scheduled'),
    ]);

    expect(todayTally(state, local(MON, '16:00'))).toEqual({ done: 3, skipped: 1, missed: 1, exercises: 4 });
  });

  it('is all zeros when nothing has fired today', () => {
    const state = inZone([...doneOn(FRI_BEFORE, 4), reminder(MON, '09:45', 'scheduled')]);
    expect(todayTally(state, local(MON, '09:00'))).toEqual(noTally);
  });
});

describe('Week marks', () => {
  const marks = (...days: [string, string][]) => days.map(([d, mark]) => ({ date: date(d), mark }));

  it('marks Mon-Fri of the current week: goal, off, missed, today and future', () => {
    const base = inZone([...doneOn(MON, 4), ...doneOn(WED, 2), ...doneOn(THU, 4)]);
    const state = { ...base, settings: { ...base.settings, activeHours: { ...base.settings.activeHours, tue: null } } };

    // Thursday is already a Goal Day, and still marked today.
    expect(weekMarks(state, local(THU, '12:00'))).toEqual(
      marks([MON, 'goal'], [TUE, 'off'], [WED, 'missed'], [THU, 'today'], [FRI, 'future']),
    );
  });

  it('on a weekend shows the whole past Mon-Fri', () => {
    const state = inZone([...doneOn(MON, 4), ...doneOn(WED, 5), ...doneOn(THU, 4), ...doneOn(FRI, 3)]);
    const expected = marks([MON, 'goal'], [TUE, 'missed'], [WED, 'goal'], [THU, 'goal'], [FRI, 'missed']);

    expect(weekMarks(state, local(SAT, '10:00'))).toEqual(expected);
    // Sunday is still the same week.
    expect(weekMarks(state, local(SUN, '23:30'))).toEqual(expected);
  });

  it('on a Monday morning is today and four future days', () => {
    const state = inZone(doneOn(FRI, 4));
    expect(weekMarks(state, local(NEXT_MON, '08:00'))).toEqual(
      marks([NEXT_MON, 'today'], [NEXT_TUE, 'future'], ['2026-11-11', 'future'], ['2026-11-12', 'future'], ['2026-11-13', 'future']),
    );
  });
});

describe('SetDailyGoal: a goal must be a whole number of at least 1', () => {
  it.each([0, -2, 2.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s: the same state object and no intents', (goal) => {
    const state = setDailyGoal(inZone(doneOn(MON, 3)), 3, local(MON, '12:30')).state;

    const result = setDailyGoal(state, goal, local(MON, '17:00'));

    expect(result.state).toBe(state);
    expect(result.intents).toEqual([]);
  });

  it('accepts a goal of 1', () => {
    const result = setDailyGoal(inZone([]), 1, local(MON, '12:30'));

    expect(result.state.goalChanges).toEqual([{ from: date(TUE), goal: 1 }]);
    expect(result.intents).toEqual([]);
    const tuesday = { ...result.state, reminders: doneOn(TUE, 1) };
    expect(isGoalDay(tuesday, date(TUE))).toBe(true);
  });
});
