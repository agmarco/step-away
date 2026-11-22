import { describe, expect, it } from 'vitest';
import {
  BODY_AREAS,
  initialState,
  reduce,
  seededRandom,
  streak,
  weekMarks,
  type BodyArea,
  type CoreDeps,
  type CoreResult,
  type CoreState,
  type Exercise,
  type Intent,
  type LocalDate,
  type Reminder,
  type ScheduledNotification,
  type SuggestedExercise,
} from './index';

// All local times below are Europe/Madrid in November 2026: CET, UTC+1, no DST change.
// 2 November 2026 is a Monday. Default Settings: Mon-Fri 09:00-18:00, 45-minute
// Interval, Daily Goal 4. A Monday 08:00 Rearm gives each weekday 09:45 + k·45.
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
const at = (time: string) => local(MON, time);
const dateOf = (instant: number) => new Date(instant + 60 * 60 * 1000).toISOString().slice(0, 10);

/** `HH:MM` from `from` to before `to` (exclusive), every `step` minutes. */
const clockTimes = (from: string, to: string, step: number): string[] => {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const out: string[] = [];
  for (let m = toMin(from); m < toMin(to); m += step) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return out;
};
const onDay = (day: string, times: string[]) => times.map((t) => local(day, t));
/** A weekday's no-Response chain: 09:45 + k·45, up to 17:15. */
const WEEKDAY_CHAIN = clockTimes('09:45', '18:00', 45);

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
const LIBRARY: Exercise[] = BODY_AREAS.flatMap((area) => [exercise(`${slug(area)}_0`, area), exercise(`${slug(area)}_1`, area)]);

const start: CoreState = { ...initialState, settings: { ...initialState.settings, timeZone: ZONE } };

const depsAt = (when: number): CoreDeps => ({ clock: { now: () => when }, random: seededRandom(7), library: LIBRARY });
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
const reminderAt = (state: CoreState, firesAt: number): Reminder => {
  const found = state.reminders.find((r) => r.firesAt === firesAt);
  if (!found) throw new Error(`no Reminder at ${new Date(firesAt).toISOString()}`);
  return found;
};

/** Monday: the 08:00 Rearm (chain 09:45 + k·45). */
const armed = (): CoreState => rearm(start, at('08:00')).state;

/** Monday: the 08:00 Rearm, then a Done at `when` on the 09:45 Reminder. The chain runs `when` + k·45. */
const doneAt = (when: string): CoreState => {
  const s = armed();
  const first = reminderAt(s, at('09:45'));
  return reduce(
    s,
    { type: 'Response', reminderId: first.id, kind: 'Done', did: [first.suggestion[0].id] },
    depsAt(at(when)),
  ).state;
};

describe('Day Off: today', () => {
  it('drops the outstanding Reminder with its dismissal, stores the Day Off, and schedules nothing today', () => {
    const state = armed();
    const outstanding = reminderAt(state, at('09:45'));

    const result = setDayOff(state, MON, true, at('10:00'));

    expect(result.state.daysOff).toEqual([date(MON)]);
    expect(reminderAt(result.state, at('09:45')).status).toBe('dropped');
    expect(result.intents).toHaveLength(2);
    expect(result.intents).toContainEqual({ type: 'DismissNotification', reminderId: outstanding.id });
    expect(timesOn(result, MON)).toEqual([]);
    expect(result.state.reminders.filter((r) => r.firesAt > at('10:00') && dateOf(r.firesAt) === MON)).toEqual([]);
  });

  it("leaves tomorrow's chain unchanged", () => {
    const result = setDayOff(armed(), MON, true, at('10:00'));

    expect(timesOf(result)[0]).toBe(local(TUE, '09:45'));
    expect(timesOn(result, TUE)).toEqual(onDay(TUE, WEEKDAY_CHAIN));
  });
});

describe('Day Off: a future date', () => {
  it('leaves that date empty in the chain, and the days around it as usual', () => {
    const result = setDayOff(doneAt('09:50'), WED, true, at('10:00'));

    expect(result.state.daysOff).toEqual([date(WED)]);
    expect(timesOn(result, WED)).toEqual([]);
    expect(timesOn(result, MON)[0]).toBe(at('10:35'));
    expect(timesOn(result, TUE)).toEqual(onDay(TUE, WEEKDAY_CHAIN));
    expect(timesOn(result, THU)).toEqual(onDay(THU, WEEKDAY_CHAIN));
  });
});

describe('Day Off: Undo today', () => {
  it("restores today's chain from now on the day's grid, with no anchor today", () => {
    // Taken off before anything fired: nothing fired today, so no anchor.
    const off: CoreState = { ...start, daysOff: [date(MON)] };

    const result = setDayOff(off, MON, false, at('11:00'));

    expect(result.state.daysOff).toEqual([]);
    expect(timesOn(result, MON)).toEqual(onDay(MON, clockTimes('11:15', '18:00', 45)));
  });

  it("restores today's chain one Interval after the last Response", () => {
    const off: CoreState = { ...doneAt('09:50'), daysOff: [date(MON)] };

    const result = setDayOff(off, MON, false, at('10:20'));

    expect(result.state.daysOff).toEqual([]);
    expect(timesOn(result, MON)).toEqual(onDay(MON, clockTimes('10:35', '18:00', 45)));
  });
});

describe('Day Off: rejections', () => {
  it('a past date is a no-op', () => {
    const state = doneAt('09:50');

    const result = setDayOff(state, FRI_BEFORE, true, at('10:00'));

    expect(result.state).toBe(state);
    expect(result.intents).toEqual([]);
  });

  it('setting off a day already off is a no-op', () => {
    const state: CoreState = { ...doneAt('09:50'), daysOff: [date(WED)] };

    const result = setDayOff(state, WED, true, at('10:00'));

    expect(result.state).toBe(state);
    expect(result.intents).toEqual([]);
  });

  it('undoing a day not off is a no-op', () => {
    const state = doneAt('09:50');

    const result = setDayOff(state, MON, false, at('10:00'));

    expect(result.state).toBe(state);
    expect(result.intents).toEqual([]);
  });
});

// Streak and week panel: literal states, as in goal-days.test.ts.
const SUGGESTION: SuggestedExercise[] = [
  {
    id: 'Side_Neck_Stretch',
    name: 'Side Neck Stretch',
    dose: { kind: 'seconds', amount: 20, eachSide: true },
    cue: 'Ear to shoulder, shoulders stay down',
    bodyArea: 'Neck',
  },
];
const NECK = { id: 'Side_Neck_Stretch', name: 'Side Neck Stretch', bodyArea: 'Neck' } as const;
const TIMES = ['09:45', '10:30', '11:15', '12:00', '12:45', '13:30'];
/** `count` Done Reminders on `day`, from 09:45 one Interval apart. */
const doneOn = (day: string, count: number): Reminder[] =>
  TIMES.slice(0, count).map((t) => ({
    id: `reminder-${local(day, t)}`,
    firesAt: local(day, t),
    suggestion: SUGGESTION,
    status: 'done',
    done: [NECK],
  }));
const withDays = (reminders: Reminder[], extra: Partial<CoreState> = {}): CoreState => ({
  ...start,
  reminders: [...reminders].sort((a, b) => a.firesAt - b.firesAt),
  ...extra,
});

describe('Streak: a Day Off neither breaks nor extends it', () => {
  it('a Day Off with nothing done between two Goal Days', () => {
    const state = withDays([...doneOn(MON, 4), ...doneOn(WED, 4)], { daysOff: [date(TUE)] });

    expect(streak(state, local(WED, '18:30'))).toBe(2);
  });

  it('a Day Off that reached its goal between two Goal Days', () => {
    const state = withDays([...doneOn(MON, 4), ...doneOn(TUE, 4), ...doneOn(WED, 4)], { daysOff: [date(TUE)] });

    expect(streak(state, local(WED, '18:30'))).toBe(2);
  });
});

describe("Streak: a Pause doesn't protect it", () => {
  it('a paused day that missed its goal breaks the Streak', () => {
    const state = withDays([...doneOn(MON, 4), ...doneOn(TUE, 2), ...doneOn(WED, 4)], {
      pauses: [{ from: local(TUE, '11:00'), until: local(WED, '00:00') }],
    });

    expect(streak(state, local(WED, '18:30'))).toBe(1);
  });
});

describe('weekMarks: dayOff', () => {
  it('marks a Day Off this week dayOff, past or ahead; today shows today even if off', () => {
    const state = withDays([...doneOn(MON, 4), ...doneOn(WED, 1)], {
      daysOff: [date(TUE), date(THU), date(FRI)],
    });

    expect(weekMarks(state, local(THU, '12:00')).map((m) => m.mark)).toEqual([
      'goal',
      'dayOff',
      'missed',
      'today',
      'dayOff',
    ]);
  });
});
