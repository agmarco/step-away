import { afterEach, describe, expect, it } from 'vitest';
import {
  initialState,
  reduce,
  seededRandom,
  type CoreDeps,
  type CoreResult,
  type CoreState,
  type Exercise,
  type Intent,
  type ScheduledNotification,
} from './index';

// All local times below are Europe/Madrid in November 2026: CET, UTC+1, no DST change.
const ZONE = 'Europe/Madrid';
const local = (date: string, time: string): number => Date.parse(`${date}T${time}:00+01:00`);

/** 09:45 + 45 min steps, last one before the 18:00 window end. */
const DAY_TIMES = ['09:45', '10:30', '11:15', '12:00', '12:45', '13:30', '14:15', '15:00', '15:45', '16:30', '17:15'];
const dayChain = (date: string, times: string[] = DAY_TIMES): number[] => times.map((t) => local(date, t));

const exercise = (overrides: Partial<Exercise> & Pick<Exercise, 'id' | 'name' | 'dose' | 'cue'>): Exercise => ({
  source: 'free-exercise-db',
  targetMuscles: ['neck'],
  bodyArea: 'Neck',
  exerciseType: 'Stretch',
  difficulty: 'Beginner',
  position: 'Either',
  equipment: null,
  energetic: false,
  steps: ['Do it.'],
  photos: null,
  ...overrides,
});

const neckStretch = exercise({
  id: 'Side_Neck_Stretch',
  name: 'Side Neck Stretch',
  dose: { kind: 'seconds', amount: 20, eachSide: true },
  cue: 'Ear to shoulder, shoulders stay down',
});
const chestSqueeze = exercise({
  id: 'Isometric_Chest_Squeezes',
  name: 'Chest Squeeze',
  dose: { kind: 'seconds', amount: 20, eachSide: false },
  cue: 'Press palms together hard, keep breathing',
});
const squat = exercise({
  id: 'Bodyweight_Squat',
  name: 'Bodyweight Squat',
  dose: { kind: 'reps', amount: 10, eachSide: false },
  cue: 'Sit back, chest up, knees over toes',
});

const start: CoreState = { ...initialState, settings: { ...initialState.settings, timeZone: ZONE } };

const depsAt = (when: number, library: Exercise[] = [neckStretch], seed = 7): CoreDeps => ({
  clock: { now: () => when },
  random: seededRandom(seed),
  library,
});

const chainOf = (result: CoreResult): ScheduledNotification[] => {
  const chains = result.intents.filter(
    (i): i is Extract<Intent, { type: 'ScheduleChain' }> => i.type === 'ScheduleChain',
  );
  expect(chains).toHaveLength(1);
  return chains[0].reminders;
};
const timesOf = (result: CoreResult): number[] => chainOf(result).map((n) => n.at);

const MON = '2026-11-02';
const TUE = '2026-11-03';
const WED = '2026-11-04';
const THU = '2026-11-05';
const FRI = '2026-11-06';
const NEXT_MON = '2026-11-09';
const NEXT_TUE = '2026-11-10';
const NEXT_WED = '2026-11-11';
const NEXT_THU = '2026-11-12';
const NEXT_FRI = '2026-11-13';

const rearm = (state: CoreState, when: number, library?: Exercise[], seed?: number) =>
  reduce(state, { type: 'Rearm' }, depsAt(when, library, seed));
const skip = (state: CoreState, reminderId: string, when: number) =>
  reduce(state, { type: 'Response', reminderId, kind: 'Skip' }, depsAt(when));
const reminderAt = (state: CoreState, firesAt: number) => {
  const found = state.reminders.find((r) => r.firesAt === firesAt);
  if (!found) throw new Error(`no Reminder at ${new Date(firesAt).toISOString()}`);
  return found;
};

describe('Rearm: the chain of upcoming Reminders', () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it('schedules the first Reminder of the day one Interval after Active Hours begin', () => {
    const result = rearm(start, local(MON, '08:00'));

    expect(timesOf(result)[0]).toBe(local(MON, '09:45'));
  });

  it('chains no-Response Reminders one Interval apart within Active Hours, over the next 7 days', () => {
    const result = rearm(start, local(MON, '08:00'));

    // 18:00 equals the window end, so Monday ends at 17:15; nothing between 18:00 and Tuesday 09:45.
    // The horizon is Mon 9 Nov 08:00, before that day's first Reminder.
    expect(timesOf(result)).toEqual([
      ...dayChain(MON),
      ...dayChain(TUE),
      ...dayChain(WED),
      ...dayChain(THU),
      ...dayChain(FRI),
    ]);
  });

  it('keeps the Reminders in state, all scheduled, matching the notifications one for one', () => {
    const result = rearm(start, local(MON, '08:00'));

    expect(result.state.reminders.map((r) => r.firesAt)).toEqual(timesOf(result));
    expect(result.state.reminders.map((r) => r.id)).toEqual(chainOf(result).map((n) => n.reminderId));
    expect(result.state.reminders.every((r) => r.status === 'scheduled')).toBe(true);
    expect(new Set(result.state.reminders.map((r) => r.id)).size).toBe(result.state.reminders.length);
  });

  it('skips days without Active Hours and stops before now + 7 days', () => {
    const morning = rearm(start, local(FRI, '08:00'));
    const result = rearm(morning.state, local(FRI, '16:00'));

    // Friday to its end, no Saturday or Sunday, Monday from 09:45, and nothing at or after Fri 13 Nov 16:00.
    expect(timesOf(result)).toEqual([
      ...dayChain(FRI, ['16:30', '17:15']),
      ...dayChain(NEXT_MON),
      ...dayChain(NEXT_TUE),
      ...dayChain(NEXT_WED),
      ...dayChain(NEXT_THU),
      ...dayChain(NEXT_FRI, DAY_TIMES.slice(0, 9)),
    ]);
  });

  it('keeps the same fire times and Ids on a mid-day Rearm with no Response, scheduling only the future', () => {
    const morning = rearm(start, local(MON, '08:00'));
    const now = local(MON, '13:00');
    const midday = rearm(morning.state, now);

    const morningFuture = chainOf(morning).filter((n) => n.at > now);
    const middayWithinMorningHorizon = chainOf(midday).filter((n) => n.at < local(NEXT_MON, '08:00'));
    expect(middayWithinMorningHorizon.map((n) => [n.reminderId, n.at])).toEqual(
      morningFuture.map((n) => [n.reminderId, n.at]),
    );
    expect(chainOf(midday).every((n) => n.at > now)).toBe(true);
    // The next Monday's morning comes into the new horizon.
    expect(chainOf(midday).at(-1)?.at).toBe(local(NEXT_MON, '12:45'));

    // The Reminders that already fired stay in state as fired, with their Ids.
    const fired = midday.state.reminders.filter((r) => r.firesAt <= now);
    expect(fired.map((r) => r.firesAt)).toEqual(dayChain(MON, ['09:45', '10:30', '11:15', '12:00', '12:45']));
    expect(fired.map((r) => r.id)).toEqual(
      morning.state.reminders.filter((r) => r.firesAt <= now).map((r) => r.id),
    );
    expect(fired.every((r) => r.status === 'scheduled')).toBe(true);
  });

  it('resolves Active Hours in the Settings time zone, whatever the machine time zone', () => {
    process.env.TZ = 'Asia/Tokyo';
    const inTokyo = rearm(start, local(MON, '08:00'));
    process.env.TZ = 'America/Los_Angeles';
    const inLosAngeles = rearm(start, local(MON, '08:00'));

    expect(timesOf(inTokyo)[0]).toBe(local(MON, '09:45'));
    expect(inLosAngeles).toEqual(inTokyo);
  });

  it('schedules nothing, without throwing, when the Exercise Library is empty', () => {
    const result = rearm(start, local(MON, '08:00'), []);

    expect(result.intents).toEqual([{ type: 'ScheduleChain', reminders: [] }]);
    expect(result.state.reminders).toEqual([]);
  });
});

describe('Suggestion', () => {
  const library = [neckStretch, chestSqueeze, squat];
  const snapshots = library.map(({ id, name, dose, cue }) => ({ id, name, dose, cue }));

  it('gives every Reminder exactly 1 Exercise from the library, as a text snapshot', () => {
    const result = rearm(start, local(MON, '08:00'), library);

    expect(result.state.reminders.length).toBeGreaterThan(0);
    for (const reminder of result.state.reminders) {
      expect(reminder.suggestion).toHaveLength(1);
      expect(snapshots).toContainEqual(reminder.suggestion[0]);
    }
  });

  it('picks with the injected Random: the same seed picks the same, different seeds can differ', () => {
    const picks = (seed: number) =>
      rearm(start, local(MON, '08:00'), library, seed).state.reminders.map((r) => r.suggestion[0].id);

    expect(picks(1)).toEqual(picks(1));
    expect(picks(1)).not.toEqual(picks(2));
  });
});

describe('notification content', () => {
  it.each([
    { dose: 'reps', ex: squat, body: 'Bodyweight Squat · 10 reps · Sit back, chest up, knees over toes' },
    { dose: 'seconds', ex: chestSqueeze, body: 'Chest Squeeze · 20 s · Press palms together hard, keep breathing' },
    {
      dose: 'seconds each side',
      ex: neckStretch,
      body: 'Side Neck Stretch · 20 s each side · Ear to shoulder, shoulders stay down',
    },
  ])('says it is time to move, shows Name · Dose · Cue ($dose), with Start, Snooze and Skip', ({ ex, body }) => {
    const first = chainOf(rearm(start, local(MON, '08:00'), [ex]))[0];

    expect(first.title).toBe('Time to move');
    expect(first.body).toBe(body);
    expect(first.actions).toEqual(['start', 'snooze', 'skip']);
  });
});

describe('Skip: a guarded Response', () => {
  const morning = () => rearm(start, local(MON, '08:00')).state;

  it('marks the outstanding Reminder skipped, dismisses it, and rebuilds the chain from the Skip', () => {
    const state = morning();
    const first = reminderAt(state, local(MON, '09:45'));
    const now = local(MON, '10:00');

    const result = skip(state, first.id, now);

    expect(reminderAt(result.state, local(MON, '09:45')).status).toBe('skipped');
    expect(result.state.lastResponseAt).toBe(now);
    expect(result.intents).toHaveLength(2);
    expect(result.intents).toContainEqual({ type: 'DismissNotification', reminderId: first.id });
    expect(timesOf(result).slice(0, 3)).toEqual(dayChain(MON, ['10:45', '11:30', '12:15']));
    expect(timesOf(result).filter((t) => t < local(TUE, '00:00')).at(-1)).toBe(local(MON, '17:15'));
    // The old 10:30 fallback is gone: the state's future matches the new chain.
    expect(result.state.reminders.filter((r) => r.firesAt > now).map((r) => r.firesAt)).toEqual(timesOf(result));
    // The next day starts fresh.
    expect(timesOf(result)).toContain(local(TUE, '09:45'));
  });

  it('ignores a duplicate Skip, only dismissing the notification again', () => {
    const state = morning();
    const first = reminderAt(state, local(MON, '09:45'));
    const once = skip(state, first.id, local(MON, '10:00')).state;

    const twice = skip(once, first.id, local(MON, '10:01'));

    expect(twice.state).toEqual(once);
    expect(twice.intents).toEqual([{ type: 'DismissNotification', reminderId: first.id }]);
  });

  it('ignores a Skip on a Reminder that has not fired yet', () => {
    const state = morning();
    const later = reminderAt(state, local(MON, '10:30'));

    const result = skip(state, later.id, local(MON, '10:00'));

    expect(result.state).toEqual(state);
    expect(result.intents).toEqual([{ type: 'DismissNotification', reminderId: later.id }]);
  });

  it('ignores a Skip on an unknown Reminder', () => {
    const state = morning();

    const result = skip(state, 'no-such-reminder', local(MON, '10:00'));

    expect(result.state).toEqual(state);
    expect(result.intents).toEqual([{ type: 'DismissNotification', reminderId: 'no-such-reminder' }]);
  });

  it('ignores a Skip on a fired Reminder that a later fired one superseded; the latest still takes it', () => {
    const state = morning();
    const stale = reminderAt(state, local(MON, '09:45'));
    const latest = reminderAt(state, local(MON, '10:30'));
    const now = local(MON, '11:00');

    const onStale = skip(state, stale.id, now);

    expect(onStale.state).toEqual(state);
    expect(onStale.intents).toEqual([{ type: 'DismissNotification', reminderId: stale.id }]);

    const onLatest = skip(state, latest.id, now);

    expect(reminderAt(onLatest.state, local(MON, '10:30')).status).toBe('skipped');
    expect(timesOf(onLatest)[0]).toBe(local(MON, '11:45'));
  });
});
