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
} from './index';

// All local times below are Europe/Madrid in November 2026: CET, UTC+1, no DST change.
// Default Settings: Mon-Fri 09:00-18:00, 45-minute Interval, 10-minute Snooze delay.
// The no-Response Monday chain is 09:45 + k·45: 09:45, 10:30, ..., 16:30, 17:15.
const ZONE = 'Europe/Madrid';
const local = (date: string, time: string): number => Date.parse(`${date}T${time}:00+01:00`);
const MON = '2026-11-02';
const TUE = '2026-11-03';
const at = (time: string) => local(MON, time);

const DAY_TIMES = ['09:45', '10:30', '11:15', '12:00', '12:45', '13:30', '14:15', '15:00', '15:45', '16:30', '17:15'];

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

// Three Exercises, so a Suggestion picked anew would likely differ from the kept one.
const library = [
  exercise({
    id: 'Side_Neck_Stretch',
    name: 'Side Neck Stretch',
    dose: { kind: 'seconds', amount: 20, eachSide: true },
    cue: 'Ear to shoulder, shoulders stay down',
  }),
  exercise({
    id: 'Isometric_Chest_Squeezes',
    name: 'Chest Squeeze',
    dose: { kind: 'seconds', amount: 20, eachSide: false },
    cue: 'Press palms together hard, keep breathing',
  }),
  exercise({
    id: 'Bodyweight_Squat',
    name: 'Bodyweight Squat',
    dose: { kind: 'reps', amount: 10, eachSide: false },
    cue: 'Sit back, chest up, knees over toes',
  }),
];

const start: CoreState = { ...initialState, settings: { ...initialState.settings, timeZone: ZONE } };

const depsAt = (when: number): CoreDeps => ({ clock: { now: () => when }, random: seededRandom(7), library });

const rearm = (state: CoreState, when: number) => reduce(state, { type: 'Rearm' }, depsAt(when));
const snooze = (state: CoreState, reminderId: string, when: number) =>
  reduce(state, { type: 'Response', reminderId, kind: 'Snooze' }, depsAt(when));
const skip = (state: CoreState, reminderId: string, when: number) =>
  reduce(state, { type: 'Response', reminderId, kind: 'Skip' }, depsAt(when));

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
/** [local time, status] of every Monday Reminder that fired by `now`, oldest first. */
const firedStatuses = (state: CoreState, now: number) =>
  DAY_TIMES.filter((t) => at(t) <= now).map((t) => [t, reminderAt(state, at(t)).status]);

/** Rearm at Mon 08:00: the no-Response chain from 09:45. */
const morning = () => rearm(start, at('08:00'));
const bodyOf = (result: CoreResult, firesAt: number): string => {
  const found = chainOf(result).find((n) => n.at === firesAt);
  if (!found) throw new Error(`no notification at ${new Date(firesAt).toISOString()}`);
  return found.body;
};

describe('Snooze: re-fires the same Reminder after the Snooze delay', () => {
  it('re-fires the outstanding Reminder with the same Id and Suggestion; the next fallback is one Interval after the re-fire', () => {
    const before = morning();
    const first = reminderAt(before.state, at('09:45'));
    const now = at('10:00');

    const result = snooze(before.state, first.id, now);

    // 10:00 + 10 = 10:10. Same Id, same Suggestion, still waiting for a final Response.
    expect(reminderAt(result.state, at('09:45'))).toEqual({ ...first, snoozes: 1, refiresAt: at('10:10') });
    // Snooze is not a final Response.
    expect(result.state.lastResponseAt).toBe(before.state.lastResponseAt);
    expect(result.intents).toHaveLength(2);
    expect(result.intents).toContainEqual(dismiss(first.id));

    const [refire] = chainOf(result);
    expect(refire).toMatchObject({ reminderId: first.id, at: at('10:10'), body: bodyOf(before, at('09:45')) });
    expect(refire.actions).toEqual(['start', 'snooze', 'skip']);

    // 10:10 + 45 = 10:55, + 45 = 11:40, + 45 = 12:25; the old 10:30 fallback is gone.
    expect(timesOf(result).slice(0, 4)).toEqual([at('10:10'), at('10:55'), at('11:40'), at('12:25')]);
    // 10:55 + 9·45 = 17:40; 17:40 + 45 = 18:25 is past the 18:00 window end.
    expect(mondayTimesOf(result).at(-1)).toBe(at('17:40'));
    // The state's future is the new chain without the re-fire (the snoozed Reminder fired at 09:45).
    expect(result.state.reminders.filter((r) => r.firesAt > now).map((r) => r.firesAt)).toEqual(
      timesOf(result).slice(1),
    );
  });

  it('takes the Snooze delay from Settings', () => {
    const fiveMinutes: CoreState = { ...start, settings: { ...start.settings, snoozeMinutes: 5 } };
    const state = rearm(fiveMinutes, at('08:00')).state;
    const first = reminderAt(state, at('09:45'));

    const result = snooze(state, first.id, at('10:00'));

    // 10:00 + 5 = 10:05; 10:05 + 45 = 10:50.
    expect(reminderAt(result.state, at('09:45')).refiresAt).toBe(at('10:05'));
    expect(timesOf(result).slice(0, 2)).toEqual([at('10:05'), at('10:50')]);
  });

  it('allows a second Snooze after the re-fire, after which the notification offers only Start and Skip', () => {
    const before = morning();
    const first = reminderAt(before.state, at('09:45'));
    const once = snooze(before.state, first.id, at('10:00')).state;

    // The 10:10 re-fire has fired; Snooze again at 10:12.
    const result = snooze(once, first.id, at('10:12'));

    // 10:12 + 10 = 10:22.
    expect(reminderAt(result.state, at('09:45'))).toEqual({ ...first, snoozes: 2, refiresAt: at('10:22') });
    expect(result.intents).toHaveLength(2);
    expect(result.intents).toContainEqual(dismiss(first.id));

    const [refire] = chainOf(result);
    expect(refire).toMatchObject({ reminderId: first.id, at: at('10:22'), body: bodyOf(before, at('09:45')) });
    expect(refire.actions).toEqual(['start', 'skip']);
    // 10:22 + 45 = 11:07.
    expect(timesOf(result)[1]).toBe(at('11:07'));
  });

  it('ignores a third Snooze, only dismissing the notification', () => {
    const first = reminderAt(morning().state, at('09:45'));
    const once = snooze(morning().state, first.id, at('10:00')).state;
    const twice = snooze(once, first.id, at('10:12')).state;

    // The 10:22 re-fire has fired; a third Snooze at 10:25.
    const result = snooze(twice, first.id, at('10:25'));

    expect(result.state).toEqual(twice);
    expect(result.intents).toEqual([dismiss(first.id)]);
  });
});

describe('Snooze: a guarded Response', () => {
  it('ignores a Snooze on a Reminder that has not fired yet', () => {
    const state = morning().state;
    const later = reminderAt(state, at('10:30'));

    const result = snooze(state, later.id, at('10:00'));

    expect(result.state).toEqual(state);
    expect(result.intents).toEqual([dismiss(later.id)]);
  });

  it('ignores a Snooze while the Reminder’s re-fire is still pending', () => {
    const first = reminderAt(morning().state, at('09:45'));
    const once = snooze(morning().state, first.id, at('10:00')).state;

    // The re-fire is at 10:10; 10:05 is before it.
    const result = snooze(once, first.id, at('10:05'));

    expect(result.state).toEqual(once);
    expect(result.intents).toEqual([dismiss(first.id)]);
  });

  it('ignores a Snooze on a Reminder that a later fired one superseded, returning the state unchanged', () => {
    const state = morning().state;
    const stale = reminderAt(state, at('09:45'));

    // 10:30 has fired by 11:00.
    const result = snooze(state, stale.id, at('11:00'));

    expect(result.state).toEqual(state);
    expect(result.intents).toEqual([dismiss(stale.id)]);
  });

  it('ignores a Snooze on an unknown Reminder', () => {
    const state = morning().state;

    const result = snooze(state, 'no-such-reminder', at('10:00'));

    expect(result.state).toEqual(state);
    expect(result.intents).toEqual([dismiss('no-such-reminder')]);
  });

  it('ignores a Snooze on a Reminder already skipped', () => {
    const first = reminderAt(morning().state, at('09:45'));
    const skipped = skip(morning().state, first.id, at('10:00')).state;

    const result = snooze(skipped, first.id, at('10:01'));

    expect(result.state).toEqual(skipped);
    expect(result.intents).toEqual([dismiss(first.id)]);
  });

  it('ignores a Snooze after closing time on the day’s last Reminder', () => {
    const state = morning().state;
    const last = reminderAt(state, at('17:15'));

    const result = snooze(state, last.id, at('18:30'));

    expect(result.state).toEqual(state);
    expect(result.intents).toEqual([dismiss(last.id)]);
  });
});

describe('late Response: a Skip after a Snooze counts', () => {
  it('accepts a Skip after the re-fire and rebuilds the chain from the Skip', () => {
    const first = reminderAt(morning().state, at('09:45'));
    const once = snooze(morning().state, first.id, at('10:00')).state;
    const now = at('10:15');

    // The 10:10 re-fire has fired; Skip at 10:15.
    const result = skip(once, first.id, now);

    expect(reminderAt(result.state, at('09:45'))).toEqual({
      ...first,
      snoozes: 1,
      refiresAt: at('10:10'),
      status: 'skipped',
    });
    expect(result.state.lastResponseAt).toBe(now);
    expect(result.intents).toHaveLength(2);
    expect(result.intents).toContainEqual(dismiss(first.id));
    // 10:15 + 45 = 11:00, 11:45, 12:30; the 10:55 fallback is gone.
    expect(timesOf(result).slice(0, 3)).toEqual([at('11:00'), at('11:45'), at('12:30')]);
    // 11:00 + 9·45 = 17:45; 17:45 + 45 = 18:30 is past the window end.
    expect(mondayTimesOf(result).at(-1)).toBe(at('17:45'));
    expect(result.state.reminders.filter((r) => r.firesAt > now).map((r) => r.firesAt)).toEqual(timesOf(result));
  });

  it('accepts a Skip after the second re-fire', () => {
    const first = reminderAt(morning().state, at('09:45'));
    const once = snooze(morning().state, first.id, at('10:00')).state;
    const twice = snooze(once, first.id, at('10:12')).state;

    // The 10:22 re-fire has fired; Skip at 10:25.
    const result = skip(twice, first.id, at('10:25'));

    expect(reminderAt(result.state, at('09:45')).status).toBe('skipped');
    // 10:25 + 45 = 11:10.
    expect(timesOf(result)[0]).toBe(at('11:10'));
  });
});

describe('Missed on replacement', () => {
  it('marks a fired Reminder with no Response Missed once a later one has fired; the newest stays outstanding', () => {
    const state = morning().state;

    // By 11:00, 09:45 and 10:30 have fired.
    const at1100 = rearm(state, at('11:00')).state;

    expect(firedStatuses(at1100, at('11:00'))).toEqual([
      ['09:45', 'missed'],
      ['10:30', 'scheduled'],
    ]);
    expect(reminderAt(at1100, at('09:45'))).toEqual({ ...reminderAt(state, at('09:45')), status: 'missed' });
    expect(outstandingReminder(at1100, at('11:00'))?.firesAt).toBe(at('10:30'));

    // By 11:30, 11:15 has fired too.
    const at1130 = rearm(state, at('11:30')).state;

    expect(firedStatuses(at1130, at('11:30'))).toEqual([
      ['09:45', 'missed'],
      ['10:30', 'missed'],
      ['11:15', 'scheduled'],
    ]);
    expect(outstandingReminder(at1130, at('11:30'))?.firesAt).toBe(at('11:15'));
  });

  it('marks a snoozed Reminder Missed once a later one fires after its re-fire', () => {
    const first = reminderAt(morning().state, at('09:45'));
    const once = snooze(morning().state, first.id, at('10:00')).state;

    // Re-fire 10:10, next fallback 10:10 + 45 = 10:55, which has fired by 11:00.
    const result = rearm(once, at('11:00')).state;

    expect(reminderAt(result, at('09:45'))).toEqual({ ...first, snoozes: 1, refiresAt: at('10:10'), status: 'missed' });
    expect(outstandingReminder(result, at('11:00'))?.firesAt).toBe(at('10:55'));
  });
});

describe('closing time', () => {
  it('marks the day’s last unanswered Reminder Missed once Active Hours end, not before', () => {
    const state = morning().state;

    // 18:30 is after the 18:00 window end: 17:15 is Missed too, and nothing is outstanding.
    const closed = rearm(state, at('18:30'));

    expect(firedStatuses(closed.state, at('18:30'))).toEqual(DAY_TIMES.map((t) => [t, 'missed']));
    expect(outstandingReminder(closed.state, at('18:30'))).toBeUndefined();
    expect(timesOf(closed)[0]).toBe(local(TUE, '09:45'));

    // 17:30 is before closing: 17:15 is still outstanding.
    const open = rearm(state, at('17:30')).state;

    expect(firedStatuses(open, at('17:30'))).toEqual([
      ...DAY_TIMES.slice(0, -1).map((t) => [t, 'missed']),
      ['17:15', 'scheduled'],
    ]);
    expect(outstandingReminder(open, at('17:30'))?.firesAt).toBe(at('17:15'));
  });

  it('never schedules a Snooze re-fire that would land at or after the window end, and drops it at closing', () => {
    const state = morning().state;
    const last = reminderAt(state, at('17:15'));

    // 17:55 + 10 = 18:05, at or after the 18:00 window end.
    const snoozed = snooze(state, last.id, at('17:55'));

    expect(reminderAt(snoozed.state, at('17:15'))).toEqual({ ...last, snoozes: 1, refiresAt: at('18:05') });
    expect(snoozed.intents).toHaveLength(2);
    expect(snoozed.intents).toContainEqual(dismiss(last.id));
    expect(chainOf(snoozed).map((n) => n.reminderId)).not.toContain(last.id);
    // The next fallback, 18:05 + 45 = 18:50, is past closing too: the chain resumes Tuesday at 09:45.
    expect(timesOf(snoozed)[0]).toBe(local(TUE, '09:45'));

    const closed = rearm(snoozed.state, at('18:30')).state;

    expect(firedStatuses(closed, at('18:30'))).toEqual([
      ...DAY_TIMES.slice(0, -1).map((t) => [t, 'missed']),
      ['17:15', 'dropped'],
    ]);
  });

  it('marks a snoozed Reminder whose re-fire landed before closing Missed, not dropped', () => {
    const state = morning().state;
    const last = reminderAt(state, at('17:15'));

    // 17:20 + 10 = 17:30, before the window end, so it is scheduled.
    const snoozed = snooze(state, last.id, at('17:20'));

    expect(chainOf(snoozed)[0]).toMatchObject({ reminderId: last.id, at: at('17:30') });
    // The next fallback, 17:30 + 45 = 18:15, is past closing.
    expect(timesOf(snoozed)[1]).toBe(local(TUE, '09:45'));

    const closed = rearm(snoozed.state, at('18:30')).state;

    expect(reminderAt(closed, at('17:15')).status).toBe('missed');
  });
});

describe('settle runs before every event', () => {
  it('returns the settled state from an accepted Skip, and the state unchanged from a guarded one', () => {
    const state = morning().state;
    const stale = reminderAt(state, at('09:45'));
    const latest = reminderAt(state, at('10:30'));
    const now = at('11:00');

    // Accepted: 10:30 is outstanding at 11:00; the settle marks the superseded 09:45 Missed.
    const onLatest = skip(state, latest.id, now);

    expect(firedStatuses(onLatest.state, now)).toEqual([
      ['09:45', 'missed'],
      ['10:30', 'skipped'],
    ]);

    // Guarded: 09:45 was superseded by 10:30. Nothing is persisted, not even the settle.
    const onStale = skip(state, stale.id, now);

    expect(onStale.state).toEqual(state);
    expect(onStale.intents).toEqual([dismiss(stale.id)]);
  });

  it('ignores a Skip after closing time on the day’s last Reminder: closing settled it Missed', () => {
    const state = morning().state;
    const last = reminderAt(state, at('17:15'));

    const result = skip(state, last.id, at('18:30'));

    expect(result.state).toEqual(state);
    expect(result.intents).toEqual([dismiss(last.id)]);
  });
});

describe('closing time on a day without Active Hours', () => {
  it('settles a Reminder whose day has no Active Hours (e.g. after a Settings change) at that day’s midnight', () => {
    const fired = morning().state;
    // Monday loses its Active Hours after the day's Reminders fired.
    const noMonday: CoreState = {
      ...fired,
      settings: { ...fired.settings, activeHours: { ...fired.settings.activeHours, mon: null } },
    };

    // 23:59 is past the old 18:00 end, but Monday now ends at midnight: 17:15 is still outstanding.
    const evening = rearm(noMonday, at('23:59')).state;

    expect(firedStatuses(evening, at('23:59'))).toEqual([
      ...DAY_TIMES.slice(0, -1).map((t) => [t, 'missed']),
      ['17:15', 'scheduled'],
    ]);
    expect(outstandingReminder(evening, at('23:59'))?.firesAt).toBe(at('17:15'));

    // Tuesday 00:00 is Monday's midnight end: 17:15 is Missed.
    const midnight = rearm(noMonday, local(TUE, '00:00')).state;

    expect(reminderAt(midnight, at('17:15')).status).toBe('missed');
    expect(outstandingReminder(midnight, local(TUE, '00:00'))).toBeUndefined();
  });
});

describe('Snooze: the re-fire notification', () => {
  it('says in its title that it was snoozed', () => {
    const before = morning();
    const first = reminderAt(before.state, at('09:45'));

    const [refire, fallback] = chainOf(snooze(before.state, first.id, at('10:00')));

    expect(refire.reminderId).toBe(first.id);
    expect(refire.title).toMatch(/snoozed/i);
    expect(fallback.title).not.toMatch(/snoozed/i);
  });
});

describe('Skip: a guarded Response while a re-fire is pending', () => {
  it('ignores a Skip before the Reminder’s re-fire has fired, only dismissing the notification', () => {
    const first = reminderAt(morning().state, at('09:45'));
    const once = snooze(morning().state, first.id, at('10:00')).state;

    // The re-fire is at 10:10; 10:05 is before it.
    const result = skip(once, first.id, at('10:05'));

    expect(result.state).toEqual(once);
    expect(result.intents).toEqual([dismiss(first.id)]);
  });
});
