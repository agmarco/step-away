import { describe, expect, it } from 'vitest';
import {
  BODY_AREAS,
  historyRange,
  initialState,
  monthMarks,
  outstandingReminder,
  pausesOn,
  reduce,
  remindersOn,
  seededRandom,
  todaysReminders,
  weekMarks,
  type BodyArea,
  type CoreDeps,
  type CoreResult,
  type CoreState,
  type DayMark,
  type Exercise,
  type Intent,
  type LocalDate,
  type Pause,
  type Reminder,
  type ScheduledNotification,
  type SuggestedExercise,
} from './index';

// Local times are Europe/Madrid from November 2026 to February 2028, always in
// CET, UTC+1 (DST ended on 25 October 2026; the fixtures avoid summer time).
// 2 November 2026 is a Monday; 30 November is a Monday, 1 December a Tuesday.
// Default Settings: Mon-Fri 09:00-18:00, 45-minute Interval, Daily Goal 4;
// weekends without Active Hours.
const ZONE = 'Europe/Madrid';
const local = (date: string, time: string): number => Date.parse(`${date}T${time}:00+01:00`);
const date = (iso: string): LocalDate => {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
};
/** The Madrid date (`YYYY-MM-DD`) of an instant in CET. */
const dateOf = (instant: number) => new Date(instant + 60 * 60 * 1000).toISOString().slice(0, 10);

const SUGGESTION: SuggestedExercise[] = [
  {
    id: 'Side_Neck_Stretch',
    name: 'Side Neck Stretch',
    dose: { kind: 'seconds', amount: 20, eachSide: true },
    cue: 'Ear to shoulder, shoulders stay down',
    bodyArea: 'Neck',
  },
];
const NECK = {
  id: 'Side_Neck_Stretch',
  name: 'Side Neck Stretch',
  bodyArea: 'Neck',
} as const;

/** A Reminder of `day` at `time`; a Done one did the Side Neck Stretch. */
const reminder = (day: string, time: string, status: Reminder['status'], extra: Partial<Reminder> = {}): Reminder => ({
  id: `reminder-${local(day, time)}`,
  firesAt: local(day, time),
  suggestion: SUGGESTION,
  status,
  ...(status === 'done' && { done: [NECK] }),
  ...extra,
});

// The no-Response chain of a weekday: 09:45 + k·45.
const TIMES = ['09:45', '10:30', '11:15', '12:00', '12:45', '13:30'];
/** `count` Done Reminders on `day`, from 09:45 one Interval apart. */
const doneOn = (day: string, count: number): Reminder[] => TIMES.slice(0, count).map((t) => reminder(day, t, 'done'));

const start: CoreState = {
  ...initialState,
  settings: { ...initialState.settings, timeZone: ZONE },
};
const withDays = (reminders: Reminder[], extra: Partial<CoreState> = {}): CoreState => ({
  ...start,
  reminders: [...reminders].sort((a, b) => a.firesAt - b.firesAt),
  ...extra,
});

/** `{ date, mark }` for day 1, 2, ... of `year`-`month`, one mark per day in order. */
const monthOf = (year: number, month: number, marks: DayMark[]) =>
  marks.map((mark, i) => ({ date: { year, month, day: i + 1 }, mark }));
const repeat = (mark: DayMark, count: number): DayMark[] => Array.from({ length: count }, () => mark);

describe('History calendar: monthMarks', () => {
  it.each([
    [2026, 11, 30],
    [2026, 12, 31],
    [2027, 2, 28],
    [2028, 2, 29],
  ])('lists every date of %i-%i in order: %i days', (year, month, days) => {
    const marks = monthMarks(start, { year, month }, local('2026-11-19', '12:00'));

    expect(marks.map((m) => m.date)).toEqual(Array.from({ length: days }, (_, i) => ({ year, month, day: i + 1 })));
  });

  // November 2026, today Thursday 19th. First use (earliest Reminder) on Wednesday 4th.
  const november = (daysOff: string[]) =>
    withDays(
      [
        ...doneOn('2026-11-04', 4), // Goal Day
        ...doneOn('2026-11-05', 2), // short of the goal
        ...doneOn('2026-11-07', 4), // a Saturday: no Active Hours, even with the goal reached
        ...doneOn('2026-11-09', 4), // a Day Off that reached its goal
        ...doneOn('2026-11-10', 4), // Goal Day
        reminder('2026-11-11', '09:45', 'skipped'),
        reminder('2026-11-12', '09:45', 'missed'),
        reminder('2026-11-13', '09:45', 'dropped'),
        ...doneOn('2026-11-19', 4), // today, already a Goal Day
        reminder('2026-11-19', '12:45', 'scheduled'),
        reminder('2026-11-20', '09:45', 'scheduled'),
      ],
      { daysOff: daysOff.map(date) },
    );

  it('marks each day by precedence: today, dayOff, future, none, off, goal, missed', () => {
    // A Day Off before first use (2nd), a past one (9th) and one ahead (24th).
    const state = november(['2026-11-02', '2026-11-09', '2026-11-24']);

    expect(monthMarks(state, { year: 2026, month: 11 }, local('2026-11-19', '12:00'))).toEqual(
      monthOf(2026, 11, [
        'none', // Sun 1: before first use, though a weekend
        'dayOff', // Mon 2: a Day Off before first use
        'none', // Tue 3: before first use
        'goal', // Wed 4
        'missed', // Thu 5: 2 of 4
        'missed', // Fri 6: nothing at all
        'off', // Sat 7: goal reached, but no Active Hours
        'off', // Sun 8
        'dayOff', // Mon 9: a Day Off, though it reached its goal
        'goal', // Tue 10
        'missed', // Wed 11: skipped
        'missed', // Thu 12: Missed
        'missed', // Fri 13: dropped
        'off', // Sat 14
        'off', // Sun 15
        'missed', // Mon 16
        'missed', // Tue 17
        'missed', // Wed 18
        'today', // Thu 19: already a Goal Day, still today
        'future', // Fri 20
        'future', // Sat 21: a weekend ahead is future, not off
        'future', // Sun 22
        'future', // Mon 23
        'dayOff', // Tue 24: a Day Off ahead
        'future', // Wed 25
        'future',
        'future',
        'future',
        'future',
        'future', // Mon 30
      ]),
    );
  });

  it('marks today today even when it is a Day Off', () => {
    const state = november(['2026-11-19']);

    const marks = monthMarks(state, { year: 2026, month: 11 }, local('2026-11-19', '12:00'));

    expect(marks[18]).toEqual({ date: date('2026-11-19'), mark: 'today' });
  });

  it('judges the whole previous month once a new month has begun', () => {
    // Today is Tuesday 1 December; Monday 30 November is past and missed.
    const state = november([]);

    const marks = monthMarks(state, { year: 2026, month: 11 }, local('2026-12-01', '09:00'));

    expect(marks.slice(18).map((m) => m.mark)).toEqual([
      'goal', // Thu 19
      'missed', // Fri 20
      'off',
      'off',
      'missed', // Mon 23
      'missed',
      'missed',
      'missed',
      'missed', // Fri 27
      'off',
      'off',
      'missed', // Mon 30
    ]);
  });

  it('marks a whole past month before first use none', () => {
    const state = november([]);

    expect(monthMarks(state, { year: 2026, month: 10 }, local('2026-11-19', '12:00'))).toEqual(
      monthOf(2026, 10, repeat('none', 31)),
    );
  });

  it('marks every past day none when there are no Reminders at all', () => {
    expect(monthMarks(start, { year: 2026, month: 11 }, local('2026-11-04', '12:00'))).toEqual(
      monthOf(2026, 11, ['none', 'none', 'none', 'today', ...repeat('future', 26)]),
    );
  });

  it('marks a fully future month future, but a Day Off there dayOff', () => {
    const state = withDays(doneOn('2026-11-04', 4), {
      daysOff: [date('2026-12-03')],
    });

    expect(monthMarks(state, { year: 2026, month: 12 }, local('2026-11-19', '12:00'))).toEqual(
      monthOf(2026, 12, ['future', 'future', 'dayOff', ...repeat('future', 28)]),
    );
  });

  it("puts a Reminder on the day of its first fire, read in the Settings' time zone", () => {
    // First use: 00:30 on Tuesday 3 November in Madrid, which is 23:30 UTC on Monday 2nd.
    // A Reminder snoozed on Wednesday 4th at 23:50 that re-fired after midnight stays on Wednesday.
    const state = withDays([
      reminder('2026-11-03', '00:30', 'skipped'),
      ...doneOn('2026-11-04', 3),
      reminder('2026-11-04', '23:50', 'done', {
        snoozes: 1,
        refiresAt: local('2026-11-05', '00:00'),
      }),
    ]);

    const marks = monthMarks(state, { year: 2026, month: 11 }, local('2026-11-06', '12:00'));

    expect(marks.slice(0, 6).map((m) => m.mark)).toEqual(['none', 'none', 'missed', 'goal', 'missed', 'today']);
  });
});

describe('Week marks: none before first use', () => {
  it('marks the weekdays before the earliest Reminder’s day none', () => {
    // First use on Wednesday 4 November.
    const state = withDays(doneOn('2026-11-04', 4));

    expect(weekMarks(state, local('2026-11-06', '12:00')).map((m) => m.mark)).toEqual([
      'none',
      'none',
      'goal',
      'missed',
      'today',
    ]);
  });

  it('marks every past weekday none when there are no Reminders, even one without Active Hours', () => {
    const state: CoreState = {
      ...start,
      settings: {
        ...start.settings,
        activeHours: { ...start.settings.activeHours, tue: null },
      },
    };

    expect(weekMarks(state, local('2026-11-05', '12:00')).map((m) => m.mark)).toEqual([
      'none',
      'none',
      'none',
      'today',
      'future',
    ]);
  });
});

describe('History calendar: historyRange', () => {
  it('runs from the month of the earliest Reminder’s day to 12 months past the current month', () => {
    const state = withDays([...doneOn('2026-10-30', 4), ...doneOn('2026-11-04', 4)]);

    expect(historyRange(state, local('2026-11-19', '12:00'))).toEqual({
      first: { year: 2026, month: 10 },
      last: { year: 2027, month: 11 },
    });
  });

  it('starts at the current month when there are no Reminders', () => {
    expect(historyRange(start, local('2026-11-19', '12:00'))).toEqual({
      first: { year: 2026, month: 11 },
      last: { year: 2027, month: 11 },
    });
  });

  it('starts at the current month when the earliest Reminder is later (only a chain ahead, next month)', () => {
    // A fresh install on Monday 30 November in the evening: the chain starts on Tuesday 1 December.
    const state = withDays([
      reminder('2026-12-01', '09:45', 'scheduled'),
      reminder('2026-12-01', '10:30', 'scheduled'),
    ]);

    expect(historyRange(state, local('2026-11-30', '19:00'))).toEqual({
      first: { year: 2026, month: 11 },
      last: { year: 2027, month: 11 },
    });
  });

  it('wraps the last month from December into the next December', () => {
    expect(historyRange(start, local('2026-12-15', '12:00'))).toEqual({
      first: { year: 2026, month: 12 },
      last: { year: 2027, month: 12 },
    });
  });

  it('keeps the first month in the previous year after New Year', () => {
    const state = withDays(doneOn('2026-11-04', 4));

    expect(historyRange(state, local('2027-01-11', '12:00'))).toEqual({
      first: { year: 2026, month: 11 },
      last: { year: 2028, month: 1 },
    });
  });

  it("reads the earliest Reminder's day in the Settings' time zone", () => {
    // 00:30 on 1 December in Madrid is 23:30 UTC on 30 November.
    const state = withDays([reminder('2026-12-01', '00:30', 'skipped')]);

    expect(historyRange(state, local('2026-12-02', '12:00')).first).toEqual({
      year: 2026,
      month: 12,
    });
  });
});

describe('History calendar: remindersOn', () => {
  // Monday 30 November and Tuesday 1 December 2026; now is Tuesday 10:00.
  const NOW = local('2026-12-01', '10:00');
  const state = withDays([
    reminder('2026-11-27', '09:45', 'done'),
    reminder('2026-11-30', '09:45', 'done'),
    reminder('2026-11-30', '10:30', 'skipped'),
    reminder('2026-11-30', '11:15', 'missed'),
    reminder('2026-11-30', '12:00', 'dropped', { droppedBy: 'pause' }),
    // Snoozed at 23:50; its re-fire lands after midnight, on Tuesday.
    reminder('2026-11-30', '23:50', 'done', {
      snoozes: 1,
      refiresAt: local('2026-12-01', '00:00'),
    }),
    // 00:30 in Madrid is 23:30 UTC on Monday.
    reminder('2026-12-01', '00:30', 'skipped'),
    reminder('2026-12-01', '09:45', 'done'),
    reminder('2026-12-01', '10:30', 'scheduled'),
    reminder('2026-12-02', '09:45', 'scheduled'),
  ]);
  const idsOf = (reminders: Reminder[]) => reminders.map((r) => r.id);
  const id = (day: string, time: string) => `reminder-${local(day, time)}`;

  it('lists a past day’s fired Reminders, newest first, whatever their status', () => {
    expect(idsOf(remindersOn(state, date('2026-11-30'), NOW))).toEqual([
      id('2026-11-30', '23:50'),
      id('2026-11-30', '12:00'),
      id('2026-11-30', '11:15'),
      id('2026-11-30', '10:30'),
      id('2026-11-30', '09:45'),
    ]);
  });

  it("leaves out other days' Reminders and those not fired yet, reading the day in the Settings' time zone", () => {
    expect(idsOf(remindersOn(state, date('2026-12-01'), NOW))).toEqual([
      id('2026-12-01', '09:45'),
      id('2026-12-01', '00:30'),
    ]);
    expect(remindersOn(state, date('2026-12-02'), NOW)).toEqual([]);
    expect(remindersOn(state, date('2026-11-29'), NOW)).toEqual([]);
  });

  it('returns the Reminders themselves, with their outcome and Snooze count', () => {
    const [snoozed] = remindersOn(state, date('2026-11-30'), NOW);

    expect(snoozed).toEqual(
      reminder('2026-11-30', '23:50', 'done', {
        snoozes: 1,
        refiresAt: local('2026-12-01', '00:00'),
      }),
    );
  });

  it('of today is todaysReminders', () => {
    expect(remindersOn(state, date('2026-12-01'), NOW)).toEqual(todaysReminders(state, NOW));
  });
});

describe('History calendar: pausesOn', () => {
  const pause = (fromDay: string, from: string, untilDay: string, until: string): Pause => ({
    from: local(fromDay, from),
    until: local(untilDay, until),
  });
  const state = withDays([], {
    pauses: [
      pause('2026-11-29', '10:00', '2026-11-29', '11:00'),
      pause('2026-11-30', '10:00', '2026-11-30', '11:00'),
      pause('2026-11-30', '14:00', '2026-11-30', '16:00'),
      // From 23:30 to 00:30: belongs to Monday only.
      pause('2026-11-30', '23:30', '2026-12-01', '00:30'),
      // 00:45 in Madrid is 23:45 UTC on Monday.
      pause('2026-12-01', '00:45', '2026-12-01', '01:45'),
      pause('2026-12-01', '11:00', '2026-12-01', '12:00'),
    ],
  });

  it('lists the Pauses that start on the date, oldest first; one across midnight belongs to its start day', () => {
    expect(pausesOn(state, date('2026-11-30'))).toEqual([
      pause('2026-11-30', '10:00', '2026-11-30', '11:00'),
      pause('2026-11-30', '14:00', '2026-11-30', '16:00'),
      pause('2026-11-30', '23:30', '2026-12-01', '00:30'),
    ]);
  });

  it("reads the start day in the Settings' time zone, not in UTC", () => {
    expect(pausesOn(state, date('2026-12-01'))).toEqual([
      pause('2026-12-01', '00:45', '2026-12-01', '01:45'),
      pause('2026-12-01', '11:00', '2026-12-01', '12:00'),
    ]);
  });

  it('is empty on a day without Pauses', () => {
    expect(pausesOn(state, date('2026-12-02'))).toEqual([]);
  });
});

// Future Day Off scheduling: through reduce, as in day-off.test.ts.
const slug = (area: BodyArea) => area.replace(/\W+/g, '_');
const exercise = (id: string, bodyArea: BodyArea): Exercise => ({
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
});
/** Two Beginner Exercises in every Body Area. */
const LIBRARY: Exercise[] = BODY_AREAS.flatMap((area) => [
  exercise(`${slug(area)}_0`, area),
  exercise(`${slug(area)}_1`, area),
]);

const depsAt = (when: number): CoreDeps => ({
  clock: { now: () => when },
  random: seededRandom(7),
  library: LIBRARY,
});
const rearm = (state: CoreState, when: number) => reduce(state, { type: 'Rearm' }, depsAt(when));
const setDayOff = (state: CoreState, day: string, off: boolean, when: number) =>
  reduce(state, { type: 'SetDayOff', date: date(day), off }, depsAt(when));

const chainOf = (result: CoreResult): ScheduledNotification[] => {
  const chains = result.intents.filter(
    (i): i is Extract<Intent, { type: 'ScheduleChain' }> => i.type === 'ScheduleChain',
  );
  expect(chains).toHaveLength(1);
  return chains[0].reminders;
};
const timesOf = (result: CoreResult): number[] => chainOf(result).map((n) => n.at);
const timesOn = (result: CoreResult, day: string) => timesOf(result).filter((t) => dateOf(t) === day);
const onDay = (day: string, times: string[]) => times.map((t) => local(day, t));
/** A weekday's no-Response chain: 09:45 + k·45, up to 17:15. */
const WEEKDAY_CHAIN = [
  '09:45',
  '10:30',
  '11:15',
  '12:00',
  '12:45',
  '13:30',
  '14:15',
  '15:00',
  '15:45',
  '16:30',
  '17:15',
];

describe('Day Off: a future date beyond the chain, in another month', () => {
  // Monday 2 November, 08:00: Tuesday 1 December is 29 days ahead, far past the 7-day chain.
  const NOV_2 = local('2026-11-02', '08:00');
  const armed = () => rearm(start, NOV_2).state;
  const DEC_1 = '2026-12-01';

  it('is accepted and stored, and leaves the chain ahead as it was', () => {
    const state = armed();

    const result = setDayOff(state, DEC_1, true, NOV_2);

    expect(result.state.daysOff).toEqual([date(DEC_1)]);
    expect(timesOf(result)).toEqual(timesOf(rearm(state, NOV_2)));
  });

  it('schedules nothing on it once a later Rearm brings it inside the chain, and the days around it as usual', () => {
    const off = setDayOff(armed(), DEC_1, true, NOV_2).state;

    const result = rearm(off, local('2026-11-30', '08:00'));

    expect(timesOn(result, DEC_1)).toEqual([]);
    expect(timesOn(result, '2026-11-30')).toEqual(onDay('2026-11-30', WEEKDAY_CHAIN));
    expect(timesOn(result, '2026-12-02')).toEqual(onDay('2026-12-02', WEEKDAY_CHAIN));
  });

  it("brings that day's Reminders back on the usual grid once undone", () => {
    const off = setDayOff(armed(), DEC_1, true, NOV_2).state;
    const undone = setDayOff(off, DEC_1, false, local('2026-11-10', '08:00'));

    expect(undone.state.daysOff).toEqual([]);
    const result = rearm(undone.state, local('2026-11-30', '08:00'));
    expect(timesOn(result, DEC_1)).toEqual(onDay(DEC_1, WEEKDAY_CHAIN));
  });

  it('shows it dayOff on the History calendar', () => {
    const off = setDayOff(armed(), DEC_1, true, NOV_2).state;

    const marks = monthMarks(off, { year: 2026, month: 12 }, NOV_2);

    expect(marks[0]).toEqual({ date: date(DEC_1), mark: 'dayOff' });
    expect(marks.slice(1).every((m) => m.mark === 'future')).toBe(true);
  });
});

describe('Day Off: tomorrow, with a Reminder outstanding today', () => {
  // Monday 30 November at 10:00, the 09:45 Reminder outstanding; tomorrow is Tuesday 1 December.
  const DEC_1_TOMORROW = '2026-12-01';

  it('leaves the outstanding Reminder outstanding: no dismissal, status unchanged', () => {
    const state = rearm(start, local('2026-11-30', '08:00')).state;
    const now = local('2026-11-30', '10:00');
    const outstanding = outstandingReminder(state, now);
    expect(outstanding?.firesAt).toBe(local('2026-11-30', '09:45'));

    const result = setDayOff(state, DEC_1_TOMORROW, true, now);

    expect(result.state.daysOff).toEqual([date(DEC_1_TOMORROW)]);
    expect(result.intents.filter((i) => i.type === 'DismissNotification')).toEqual([]);
    expect(result.state.reminders.find((r) => r.id === outstanding?.id)?.status).toBe('scheduled');
    expect(outstandingReminder(result.state, now)?.id).toBe(outstanding?.id);
    expect(timesOn(result, DEC_1_TOMORROW)).toEqual([]);
  });
});
