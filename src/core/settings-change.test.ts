import { describe, expect, it } from 'vitest';
import {
  BODY_AREAS,
  defaultSettings,
  initialState,
  reduce,
  seededRandom,
  type ActiveWindow,
  type BodyArea,
  type CoreDeps,
  type CoreEvent,
  type CoreResult,
  type CoreState,
  type Exercise,
  type Intent,
  type Reminder,
  type ScheduledNotification,
  type Settings,
  type SuggestedExercise,
} from './index';

// All local times below are Europe/Madrid in November 2026: CET, UTC+1, no DST change.
// Default Settings: Mon-Fri 09:00-18:00, 45-minute Interval, 10-minute Snooze delay.
// A Monday 08:00 Rearm gives Monday's chain 09:45 + k·45 (09:45, 10:30, ..., 17:15).
const ZONE = 'Europe/Madrid';
const local = (date: string, time: string): number => Date.parse(`${date}T${time}:00+01:00`);
const MON = '2026-11-02';
const TUE = '2026-11-03';
const WED = '2026-11-04';
const SAT = '2026-11-07';
const SUN = '2026-11-08';
const at = (time: string) => local(MON, time);

/** `HH:MM` from `from` to before `to` (exclusive), every `step` minutes. */
const clockTimes = (from: string, to: string, step: number): string[] => {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const out: string[] = [];
  for (let m = toMin(from); m < toMin(to); m += step) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return out;
};
const onDay = (date: string, times: string[]) => times.map((t) => local(date, t));
const dateOf = (instant: number) => new Date(instant + 60 * 60 * 1000).toISOString().slice(0, 10);

const slug = (area: BodyArea) => area.replace(/\W+/g, '_');
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

/** Two Beginner Exercises in every Body Area, plus one Intermediate and one dumbbells Exercise per area. */
const LIBRARY: Exercise[] = BODY_AREAS.flatMap((area) => [
  exercise(`${slug(area)}_0`, area),
  exercise(`${slug(area)}_1`, area),
  exercise(`${slug(area)}_Intermediate`, area, { difficulty: 'Intermediate' }),
  exercise(`${slug(area)}_Dumbbell`, area, { equipment: 'dumbbells' }),
]);
const byId = (id: string): Exercise => {
  const found = LIBRARY.find((e) => e.id === id);
  if (!found) throw new Error(`${id} is not in the library`);
  return found;
};

const cfg = (settings: Partial<Settings> = {}, reminders: Reminder[] = []): CoreState => ({
  ...initialState,
  settings: { ...initialState.settings, timeZone: ZONE, ...settings },
  reminders,
});
const start = cfg();

const depsAt = (when: number, seed = 7): CoreDeps => ({
  clock: { now: () => when },
  random: seededRandom(seed),
  library: LIBRARY,
});
const rearm = (state: CoreState, when: number) => reduce(state, { type: 'Rearm' }, depsAt(when));
const change = (state: CoreState, settings: Extract<CoreEvent, { type: 'ChangeSettings' }>['change'], when: number) =>
  reduce(state, { type: 'ChangeSettings', change: settings }, depsAt(when));
const snooze = (state: CoreState, reminderId: string, when: number) =>
  reduce(state, { type: 'Response', reminderId, kind: 'Snooze' }, depsAt(when));

const chainOf = (result: CoreResult): ScheduledNotification[] => {
  const chains = result.intents.filter(
    (i): i is Extract<Intent, { type: 'ScheduleChain' }> => i.type === 'ScheduleChain',
  );
  expect(chains).toHaveLength(1);
  return chains[0].reminders;
};
const timesOf = (result: CoreResult): number[] => chainOf(result).map((n) => n.at);
const intentTypes = (result: CoreResult) => result.intents.map((i) => i.type);
const reminderAt = (state: CoreState, firesAt: number): Reminder => {
  const found = state.reminders.find((r) => r.firesAt === firesAt);
  if (!found) throw new Error(`no Reminder at ${new Date(firesAt).toISOString()}`);
  return found;
};
const ahead = (state: CoreState, now: number) => state.reminders.filter((r) => r.firesAt > now);

/** Monday: the 08:00 Rearm, then a Done at 10:00 on the 09:45 Reminder. The chain runs 10:45 + k·45. */
const doneAtTen = (): CoreState => {
  const armed = rearm(start, at('08:00')).state;
  const first = reminderAt(armed, at('09:45'));
  const result = reduce(
    armed,
    { type: 'Response', reminderId: first.id, kind: 'Done', did: [first.suggestion[0].id] },
    depsAt(at('10:00')),
  );
  expect(result.state.lastResponseAt).toBe(at('10:00'));
  expect(timesOf(result)[0]).toBe(at('10:45'));
  return result.state;
};

describe('ChangeSettings: Interval, as if always set', () => {
  it('a change at 10:20 to 30 min after a Done at 10:00 makes the chain 10:30, 11:00, ...', () => {
    const result = change(doneAtTen(), { intervalMinutes: 30 }, at('10:20'));

    const today = timesOf(result).filter((t) => dateOf(t) === MON);
    expect(today).toEqual(onDay(MON, clockTimes('10:30', '18:00', 30)));
    // Other days start one new Interval after their window opens.
    expect(timesOf(result).filter((t) => dateOf(t) === TUE)).toEqual(onDay(TUE, clockTimes('09:30', '18:00', 30)));
  });

  it('a change to 60 min makes the chain 11:00, 12:00, ...', () => {
    const result = change(doneAtTen(), { intervalMinutes: 60 }, at('10:20'));

    const today = timesOf(result).filter((t) => dateOf(t) === MON);
    expect(today).toEqual(onDay(MON, clockTimes('11:00', '18:00', 60)));
  });

  it('past grid: a change at 10:40 to 15 min gives 10:45 next, the first grid time after now, with no catch-up', () => {
    const result = change(doneAtTen(), { intervalMinutes: 15 }, at('10:40'));

    const today = timesOf(result).filter((t) => dateOf(t) === MON);
    // The grid is 10:15, 10:30, 10:45, ...: 10:15 and 10:30 are past, and nothing fires at 10:40.
    expect(today[0]).toBe(at('10:45'));
    expect(today).toEqual(onDay(MON, clockTimes('10:45', '18:00', 15)));
    expect(result.state.reminders.some((r) => r.firesAt > at('10:00') && r.firesAt <= at('10:40'))).toBe(false);
  });

  it('returns only ScheduleChain and keeps the new Interval in state', () => {
    const before = doneAtTen();
    const result = change(before, { intervalMinutes: 30 }, at('10:20'));

    expect(intentTypes(result)).toEqual(['ScheduleChain']);
    expect(result.state.settings).toEqual({ ...before.settings, intervalMinutes: 30 });
    // The Reminders in state match the scheduled chain one for one.
    expect(ahead(result.state, at('10:20')).map((r) => r.firesAt)).toEqual(timesOf(result));
  });
});

describe('ChangeSettings: Active Hours', () => {
  const nineToSix: ActiveWindow = { start: 9 * 60, end: 18 * 60 };
  const hours = (overrides: Partial<Settings['activeHours']>): Settings['activeHours'] => ({
    ...defaultSettings.activeHours,
    ...overrides,
  });

  it("a window ending before the anchor + Interval moves the next Reminder to the next window", () => {
    // Monday now ends at 10:30: the Done at 10:00 + 45 min falls outside it.
    const result = change(doneAtTen(), { activeHours: hours({ mon: { start: 9 * 60, end: 10 * 60 + 30 } }) }, at('10:20'));

    expect(timesOf(result).filter((t) => dateOf(t) === MON)).toEqual([]);
    expect(timesOf(result)[0]).toBe(local(TUE, '09:45'));
  });

  it("a window opening later today starts the chain one Interval after it opens", () => {
    // Monday now opens at 11:00: the 10:00 anchor is outside it, so today follows the new day's grid.
    const result = change(doneAtTen(), { activeHours: hours({ mon: { start: 11 * 60, end: 18 * 60 } }) }, at('10:20'));

    expect(timesOf(result)[0]).toBe(at('11:45'));
  });

  it('turning a day off removes its Reminders', () => {
    const before = doneAtTen();
    expect(before.reminders.some((r) => dateOf(r.firesAt) === TUE)).toBe(true);

    const result = change(before, { activeHours: hours({ tue: null }) }, at('10:20'));

    expect(timesOf(result).filter((t) => dateOf(t) === TUE)).toEqual([]);
    expect(result.state.reminders.filter((r) => dateOf(r.firesAt) === TUE)).toEqual([]);
    expect(timesOf(result).filter((t) => dateOf(t) === WED)[0]).toBe(local(WED, '09:45'));
  });

  it('turning a weekend day on adds its Reminders', () => {
    const before = doneAtTen();
    expect(before.reminders.some((r) => dateOf(r.firesAt) === SAT)).toBe(false);

    const result = change(before, { activeHours: hours({ sat: nineToSix }) }, at('10:20'));

    expect(timesOf(result).filter((t) => dateOf(t) === SAT)).toEqual(onDay(SAT, clockTimes('09:45', '18:00', 45)));
    expect(timesOf(result).filter((t) => dateOf(t) === SUN)).toEqual([]);
  });

  it('all days off leaves no Reminders ahead', () => {
    const allOff = { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null };
    const result = change(doneAtTen(), { activeHours: allOff }, at('10:20'));

    expect(intentTypes(result)).toEqual(['ScheduleChain']);
    expect(timesOf(result)).toEqual([]);
    expect(ahead(result.state, at('10:20'))).toEqual([]);
    expect(result.state.settings.activeHours).toEqual(allOff);
  });
});

describe('ChangeSettings: the outstanding Reminder keeps its Suggestion', () => {
  /** Fired at Monday 09:45 with no Response yet: outstanding at 09:50. */
  const outstanding = (exercises: Exercise[]): Reminder => ({
    id: `reminder-${at('09:45')}`,
    firesAt: at('09:45'),
    suggestion: exercises.map(snapshot),
    status: 'scheduled',
  });
  const NOW = at('09:50');

  /** Changes `settings` at 09:50 and checks the outstanding Reminder is byte-identical; returns the Reminders ahead. */
  const changeKeeping = (initial: Partial<Settings>, kept: Exercise[], next: Partial<Settings>): Reminder[] => {
    const before = cfg(initial, [outstanding(kept)]);
    const result = change(before, next, NOW);

    const after = reminderAt(result.state, at('09:45'));
    expect(JSON.stringify(after.suggestion)).toBe(JSON.stringify(before.reminders[0].suggestion));
    expect(after).toEqual(before.reminders[0]);
    expect(intentTypes(result)).toEqual(['ScheduleChain']);

    const rest = ahead(result.state, NOW);
    expect(rest.length).toBeGreaterThan(0);
    return rest;
  };

  it('Exercises per Suggestion: the outstanding one keeps 1, the Reminders ahead get 3', () => {
    const rest = changeKeeping({}, [byId('Neck_0')], { exercisesPerSuggestion: 3 });

    expect(rest.every((r) => r.suggestion.length === 3)).toBe(true);
  });

  it('Difficulty: an Intermediate Exercise stays outstanding, the Reminders ahead are Beginner only', () => {
    const rest = changeKeeping({ difficulty: 'Intermediate' }, [byId('Neck_Intermediate')], { difficulty: 'Beginner' });

    const difficulties = new Set(rest.flatMap((r) => r.suggestion.map((e) => byId(e.id).difficulty)));
    expect([...difficulties]).toEqual(['Beginner']);
  });

  it('Equipment: a dumbbells Exercise stays outstanding, the Reminders ahead need no Equipment', () => {
    const rest = changeKeeping({ equipment: ['dumbbells'] }, [byId('Neck_Dumbbell')], { equipment: [] });

    expect(rest.flatMap((r) => r.suggestion.map((e) => byId(e.id).equipment)).every((e) => e === null)).toBe(true);
  });

  it('Body Area mode: the outstanding one keeps no rotation, the Reminders ahead are built in Strict', () => {
    const rest = changeKeeping({ bodyAreaMode: 'Weighted' }, [byId('Neck_0')], { bodyAreaMode: 'Strict' });

    expect(rest.every((r) => r.rotation !== undefined)).toBe(true);
  });
});

describe('ChangeSettings: Snooze delay', () => {
  it('a Snooze on the current outstanding Reminder after a change from 10 to 20 min re-fires at now + 20', () => {
    const armed = rearm(start, at('08:00')).state;
    const changed = change(armed, { snoozeMinutes: 20 }, at('09:50')).state;

    const result = snooze(changed, `reminder-${at('09:45')}`, at('09:55'));

    expect(reminderAt(result.state, at('09:45')).refiresAt).toBe(at('10:15'));
    expect(chainOf(result).find((n) => n.reminderId === `reminder-${at('09:45')}`)?.at).toBe(at('10:15'));
  });

  it('a re-fire already pending keeps its time', () => {
    const armed = rearm(start, at('08:00')).state;
    const snoozed = snooze(armed, `reminder-${at('09:45')}`, at('09:50')).state;
    expect(reminderAt(snoozed, at('09:45')).refiresAt).toBe(at('10:00'));

    const result = change(snoozed, { snoozeMinutes: 20 }, at('09:55'));

    expect(result.state.settings.snoozeMinutes).toBe(20);
    expect(reminderAt(result.state, at('09:45')).refiresAt).toBe(at('10:00'));
    expect(chainOf(result).find((n) => n.reminderId === `reminder-${at('09:45')}`)?.at).toBe(at('10:00'));
  });
});

describe('ChangeSettings: validation', () => {
  const NOW = at('10:20');
  const armed = () => rearm(start, at('08:00')).state;
  const monday = (window: ActiveWindow) => ({ ...defaultSettings.activeHours, mon: window });
  // Casts stand for what an untyped caller (a stale store, a bug) could send.
  type Change = Extract<CoreEvent, { type: 'ChangeSettings' }>['change'];
  const loose = (c: Record<string, unknown>) => c as Change;

  it.each<[string, Change]>([
    ['Interval 10 (below 15)', { intervalMinutes: 10 }],
    ['Interval 125 (above 120)', { intervalMinutes: 125 }],
    ['Interval 47 (not a step of 5)', { intervalMinutes: 47 }],
    ['Interval 2 (Test mode only)', { intervalMinutes: 2 }],
    ['Snooze delay 7', { snoozeMinutes: 7 }],
    ['Exercises per Suggestion 0', { exercisesPerSuggestion: 0 }],
    ['Exercises per Suggestion 4', { exercisesPerSuggestion: 4 }],
    ['an unknown Body Area mode', loose({ bodyAreaMode: 'Sequential' })],
    ['an unknown Difficulty', loose({ difficulty: 'Advanced' })],
    ['an unknown appearance', loose({ appearance: 'Auto' })],
    ['an unknown Equipment', loose({ equipment: ['barbell'] })],
    ['a duplicated Equipment', { equipment: ['dumbbells', 'dumbbells'] }],
    ['an Exclusion that is not a string', loose({ excluded: [42] })],
    ['a window with start == end', { activeHours: monday({ start: 600, end: 600 }) }],
    ['a window with start > end', { activeHours: monday({ start: 700, end: 600 }) }],
    ['a window with a negative start', { activeHours: monday({ start: -15, end: 600 }) }],
    ['a window ending after 1440', { activeHours: monday({ start: 540, end: 1445 }) }],
    ['a window with a non-integer bound', { activeHours: monday({ start: 540.5, end: 600 }) }],
  ])('rejects %s: the same state object, no intents', (_label, invalid) => {
    const before = armed();

    const result = change(before, invalid, NOW);

    expect(result.state).toBe(before);
    expect(result.intents).toEqual([]);
  });

  it.each<[string, Change]>([
    ['Interval 15', { intervalMinutes: 15 }],
    ['Interval 120', { intervalMinutes: 120 }],
    ['Snooze delay 5', { snoozeMinutes: 5 }],
    ['Snooze delay 30', { snoozeMinutes: 30 }],
    ['Exercises per Suggestion 1', { exercisesPerSuggestion: 1 }],
    ['Exercises per Suggestion 3', { exercisesPerSuggestion: 3 }],
    ['Body Area mode Random', { bodyAreaMode: 'Random' }],
    ['Difficulty Expert', { difficulty: 'Expert' }],
    ['appearance Light', { appearance: 'Light' }],
    ['Energetic on', { energetic: true }],
    ['Floor on', { floor: true }],
    ['Equipment owned', { equipment: ['foam roller', 'dumbbells'] }],
    ['Exclusions', { excluded: ['Neck_0'] }],
    ['a whole-day window, 0 to 1440', { activeHours: monday({ start: 0, end: 1440 }) }],
    ['a day off', { activeHours: { ...defaultSettings.activeHours, wed: null } }],
  ])('accepts %s: stored, the time zone kept, and the chain rescheduled', (_label, valid) => {
    const before = armed();

    const result = change(before, valid, NOW);

    expect(result.state.settings).toEqual({ ...before.settings, ...valid });
    expect(result.state.settings.timeZone).toBe(ZONE);
    expect(intentTypes(result)).toEqual(['ScheduleChain']);
  });
});

describe('ChangeSettings: Appearance', () => {
  it("stores 'Dark' and rearms like any other change, with the same chain times", () => {
    const before = doneAtTen();
    const unchanged = timesOf(rearm(before, at('10:20')));

    const result = change(before, { appearance: 'Dark' }, at('10:20'));

    expect(result.state.settings).toEqual({ ...before.settings, appearance: 'Dark' });
    expect(intentTypes(result)).toEqual(['ScheduleChain']);
    expect(timesOf(result)).toEqual(unchanged);
  });
});
