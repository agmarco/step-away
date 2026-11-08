import { describe, expect, it } from 'vitest';
import {
  canSnooze,
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
} from './index';

// All local times below are Europe/Madrid in November 2026: CET, UTC+1, no DST change.
// Default Settings: Mon-Fri 09:00-18:00, 45-minute Interval, 10-minute Snooze delay.
// The no-Response Monday chain is 09:45 + k·45: 09:45, 10:30, ..., 16:30, 17:15.
const ZONE = 'Europe/Madrid';
const local = (date: string, time: string): number => Date.parse(`${date}T${time}:00+01:00`);
const MON = '2026-11-02';
const TUE = '2026-11-03';
const at = (time: string) => local(MON, time);

const library: Exercise[] = [
  {
    id: 'Side_Neck_Stretch',
    name: 'Side Neck Stretch',
    dose: { kind: 'seconds', amount: 20, eachSide: true },
    cue: 'Ear to shoulder, shoulders stay down',
    bodyArea: 'Neck',
    source: 'free-exercise-db',
    targetMuscles: ['neck'],
    exerciseType: 'Stretch',
    difficulty: 'Beginner',
    position: 'Either',
    equipment: null,
    energetic: false,
    steps: ['Do it.'],
    photos: null,
  },
];

const start: CoreState = { ...initialState, settings: { ...initialState.settings, timeZone: ZONE } };

const depsAt = (when: number): CoreDeps => ({ clock: { now: () => when }, random: seededRandom(7), library });

const rearm = (state: CoreState, when: number) => reduce(state, { type: 'Rearm' }, depsAt(when));
const snooze = (state: CoreState, reminderId: string, when: number) =>
  reduce(state, { type: 'Response', reminderId, kind: 'Snooze' }, depsAt(when));

const timesOf = (result: CoreResult): number[] => {
  const chains = result.intents.filter(
    (i): i is Extract<Intent, { type: 'ScheduleChain' }> => i.type === 'ScheduleChain',
  );
  expect(chains).toHaveLength(1);
  return chains[0].reminders.map((n: ScheduledNotification) => n.at);
};

const reminderAt = (state: CoreState, firesAt: number): Reminder => {
  const found = state.reminders.find((r) => r.firesAt === firesAt);
  if (!found) throw new Error(`no Reminder at ${new Date(firesAt).toISOString()}`);
  return found;
};

/** Rearm at Mon 08:00: the no-Response chain from 09:45. */
const morning = (): CoreState => rearm(start, at('08:00')).state;

describe('canSnooze: fewer than 2 Snoozes and no re-fire pending', () => {
  it('allows a Snooze on a Reminder never snoozed', () => {
    const first = reminderAt(morning(), at('09:45'));

    expect(canSnooze(first, at('10:00'))).toBe(true);
  });

  it('refuses while the re-fire is pending, allows it again once the re-fire has fired', () => {
    const first = reminderAt(morning(), at('09:45'));
    // Snoozed at 10:00: the re-fire is at 10:10.
    const once = reminderAt(snooze(morning(), first.id, at('10:00')).state, at('09:45'));

    expect(canSnooze(once, at('10:05'))).toBe(false);
    expect(canSnooze(once, at('10:10'))).toBe(true);
  });

  it('refuses after 2 Snoozes, even once the second re-fire has fired', () => {
    const first = reminderAt(morning(), at('09:45'));
    const once = snooze(morning(), first.id, at('10:00')).state;
    // The 10:10 re-fire has fired; Snooze again at 10:12, re-firing at 10:22.
    const twice = reminderAt(snooze(once, first.id, at('10:12')).state, at('09:45'));

    expect(canSnooze(twice, at('10:25'))).toBe(false);
  });
});

const guidedStarted = (state: CoreState, reminderId: string, when: number) =>
  reduce(state, { type: 'GuidedStarted', reminderId }, depsAt(when));

describe('GuidedStarted: opening the guided screen cancels a pending Snooze re-fire', () => {
  it('clears the re-fire, keeps the Snooze count and rebuilds the chain from the Reminder’s own fire time', () => {
    const first = reminderAt(morning(), at('09:45'));
    // Snoozed at 10:00: the re-fire is at 10:10, and the chain counts from it (10:55, 11:40, ...).
    const once = snooze(morning(), first.id, at('10:00')).state;

    // The guided screen opens at 10:05, before the re-fire.
    const result = guidedStarted(once, first.id, at('10:05'));

    // Not a Response: still scheduled, the Snooze still counts, no re-fire.
    expect(reminderAt(result.state, at('09:45'))).toStrictEqual({ ...first, snoozes: 1 });
    expect(result.state.lastResponseAt).toBeNull();
    // Only the rebuilt chain: the screen has already dismissed the notification.
    expect(result.intents).toHaveLength(1);
    const chain = result.intents[0] as Extract<Intent, { type: 'ScheduleChain' }>;
    expect(chain.type).toBe('ScheduleChain');
    expect(chain.reminders.map((n) => n.reminderId)).not.toContain(first.id);
    // 09:45 + 45 = 10:30, the first grid time after 10:05; the 10:10 re-fire and the 10:55 fallback are gone.
    expect(timesOf(result).slice(0, 2)).toEqual([at('10:30'), at('11:15')]);
    expect(timesOf(result).filter((t) => t < local(TUE, '00:00')).at(-1)).toBe(at('17:15'));
    expect(result.state.reminders.filter((r) => r.firesAt > at('10:05')).map((r) => r.firesAt)).toEqual(
      timesOf(result),
    );
  });

  it('leaves the Reminder outstanding until the next Reminder fires', () => {
    const first = reminderAt(morning(), at('09:45'));
    const once = snooze(morning(), first.id, at('10:00')).state;

    const started = guidedStarted(once, first.id, at('10:05')).state;

    expect(outstandingReminder(started, at('10:05'))?.id).toBe(first.id);
    // Past the cancelled 10:10 re-fire, and just before the 10:30 Reminder fires.
    expect(outstandingReminder(started, at('10:29'))?.id).toBe(first.id);
    expect(outstandingReminder(started, at('10:30'))?.id).not.toBe(first.id);
  });
});

describe('GuidedStarted: a later Snooze, per canSnooze', () => {
  it('allows a second Snooze once the first re-fire is cancelled, and none after 2', () => {
    const first = reminderAt(morning(), at('09:45'));
    const once = snooze(morning(), first.id, at('10:00')).state;
    const started = guidedStarted(once, first.id, at('10:05')).state;
    expect(canSnooze(reminderAt(started, at('09:45')), at('10:06'))).toBe(true);

    // Snooze from the guided screen at 10:06: re-fires at 10:16, the second Snooze.
    const twice = snooze(started, first.id, at('10:06'));
    expect(reminderAt(twice.state, at('09:45'))).toStrictEqual({ ...first, snoozes: 2, refiresAt: at('10:16') });

    // Opened again at 10:08: the 10:16 re-fire is cancelled, but 2 Snoozes are used up.
    const again = guidedStarted(twice.state, first.id, at('10:08')).state;
    expect(reminderAt(again, at('09:45'))).toStrictEqual({ ...first, snoozes: 2 });
    expect(canSnooze(reminderAt(again, at('09:45')), at('10:09'))).toBe(false);
    expect(snooze(again, first.id, at('10:09')).state).toBe(again);
  });
});

describe('GuidedStarted: otherwise a no-op that returns the same state', () => {
  it('does nothing on the outstanding Reminder with no re-fire pending', () => {
    const state = morning();
    const first = reminderAt(state, at('09:45'));

    expect(guidedStarted(state, first.id, at('10:00'))).toEqual({ state, intents: [] });
    expect(guidedStarted(state, first.id, at('10:00')).state).toBe(state);
  });

  it('does nothing once the re-fire has fired', () => {
    const first = reminderAt(morning(), at('09:45'));
    const once = snooze(morning(), first.id, at('10:00')).state;

    // The 10:10 re-fire has fired.
    const result = guidedStarted(once, first.id, at('10:12'));

    expect(result.state).toBe(once);
    expect(result.intents).toEqual([]);
  });

  it('does nothing on a Reminder that is not the outstanding one, or an unknown Id', () => {
    const state = morning();
    const first = reminderAt(state, at('09:45'));
    const once = snooze(state, first.id, at('10:00')).state;
    const ahead = reminderAt(once, at('10:55'));

    // Not fired yet.
    expect(guidedStarted(once, ahead.id, at('10:05')).state).toBe(once);
    expect(guidedStarted(once, ahead.id, at('10:05')).intents).toEqual([]);
    // Unknown.
    expect(guidedStarted(once, 'reminder-0', at('10:05')).state).toBe(once);
    expect(guidedStarted(once, 'reminder-0', at('10:05')).intents).toEqual([]);
  });

  it('does nothing on a snoozed Reminder already answered', () => {
    const first = reminderAt(morning(), at('09:45'));
    const once = snooze(morning(), first.id, at('10:00')).state;
    const skipped = reduce(once, { type: 'Response', reminderId: first.id, kind: 'Skip' }, depsAt(at('10:12'))).state;

    const result = guidedStarted(skipped, first.id, at('10:13'));

    expect(result.state).toBe(skipped);
    expect(result.intents).toEqual([]);
  });
});
