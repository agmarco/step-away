import { describe, expect, it } from 'vitest';
import {
  BODY_AREAS,
  heroStatus,
  initialState,
  reduce,
  seededRandom,
  todaysPauses,
  todayTally,
  type BodyArea,
  type CoreDeps,
  type CoreResult,
  type CoreState,
  type Exercise,
  type Intent,
  type PauseLength,
  type Reminder,
  type ScheduledNotification,
} from './index';

// All local times below are Europe/Madrid in November 2026: CET, UTC+1, no DST change.
// Default Settings: Mon-Fri 09:00-18:00, 45-minute Interval, 10-minute Snooze delay.
// A Monday 08:00 Rearm gives Monday's chain 09:45 + k·45 (09:45, 10:30, ..., 17:15).
const ZONE = 'Europe/Madrid';
const local = (date: string, time: string): number => Date.parse(`${date}T${time}:00+01:00`);
const SUN = '2026-11-01';
const MON = '2026-11-02';
const TUE = '2026-11-03';
const at = (time: string) => local(MON, time);
const dateOf = (instant: number) => new Date(instant + 60 * 60 * 1000).toISOString().slice(0, 10);

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
const pause = (state: CoreState, length: PauseLength, when: number) =>
  reduce(state, { type: 'Pause', length }, depsAt(when));
const resume = (state: CoreState, when: number) => reduce(state, { type: 'Resume' }, depsAt(when));
const appOpened = (state: CoreState, when: number) => reduce(state, { type: 'AppOpened' }, depsAt(when));

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

/** Monday: the 08:00 Rearm, then a Snooze at 09:50 on the 09:45 Reminder (re-fire at 10:00). */
const snoozedAt0950 = (): CoreState => {
  const s = armed();
  return reduce(s, { type: 'Response', reminderId: reminderAt(s, at('09:45')).id, kind: 'Snooze' }, depsAt(at('09:50')))
    .state;
};

const insideAny = (t: number, pauses: { from: number; until: number }[]) =>
  pauses.some((p) => t >= p.from && t < p.until);

describe('Pause: each length', () => {
  it('hour: pauses 10:00-11:00, and the next Reminder is 11:45', () => {
    const result = pause(doneAt('09:50'), 'hour', at('10:00'));

    expect(result.state.pauses).toEqual([{ from: at('10:00'), until: at('11:00') }]);
    expect(timesOf(result)[0]).toBe(at('11:45'));
    expect(timesOf(result).filter((t) => dateOf(t) === MON)).toEqual(
      ['11:45', '12:30', '13:15', '14:00', '14:45', '15:30', '16:15', '17:00', '17:45'].map(at),
    );
  });

  it('twoHours: pauses 10:00-12:00, and the next Reminder is 12:45', () => {
    const result = pause(doneAt('09:50'), 'twoHours', at('10:00'));

    expect(result.state.pauses).toEqual([{ from: at('10:00'), until: at('12:00') }]);
    expect(timesOf(result)[0]).toBe(at('12:45'));
  });

  it('restOfToday: pauses until the next local midnight; nothing more today, and the next is Tuesday 09:45', () => {
    const result = pause(doneAt('09:50'), 'restOfToday', at('10:00'));

    expect(result.state.pauses).toEqual([{ from: at('10:00'), until: local(TUE, '00:00') }]);
    expect(timesOf(result).filter((t) => dateOf(t) === MON)).toEqual([]);
    expect(timesOf(result)[0]).toBe(local(TUE, '09:45'));
  });

  it.each<PauseLength>(['hour', 'twoHours', 'restOfToday'])(
    '%s: no chain time, and no Reminder ahead in state, falls inside the Pause',
    (length) => {
      const result = pause(doneAt('09:50'), length, at('10:00'));
      const { pauses } = result.state;

      expect(pauses).toHaveLength(1);
      expect(timesOf(result).length).toBeGreaterThan(0);
      expect(timesOf(result).filter((t) => insideAny(t, pauses))).toEqual([]);
      const ahead = result.state.reminders.filter((r) => r.firesAt > at('10:00'));
      expect(ahead.filter((r) => insideAny(r.firesAt, pauses))).toEqual([]);
    },
  );
});

describe('Pause: extend', () => {
  it('a second Pause while one is running replaces its until, keeping from and one entry', () => {
    const first = pause(doneAt('09:50'), 'hour', at('10:00')).state;

    const result = pause(first, 'twoHours', at('10:30'));

    expect(result.state.pauses).toEqual([{ from: at('10:00'), until: at('12:30') }]);
    expect(timesOf(result)[0]).toBe(at('13:15'));
  });
});

describe('Pause and Resume: rejections', () => {
  it('a Pause on a Day Off is a no-op', () => {
    const state: CoreState = { ...doneAt('09:50'), daysOff: [{ year: 2026, month: 11, day: 2 }] };

    const result = pause(state, 'hour', at('10:00'));

    expect(result.state).toBe(state);
    expect(result.intents).toEqual([]);
  });

  it('Resume with no Pause running is a no-op', () => {
    const state = doneAt('09:50');

    const result = resume(state, at('10:00'));

    expect(result.state).toBe(state);
    expect(result.intents).toEqual([]);
  });

  it('Resume after the Pause ended is a no-op', () => {
    const state: CoreState = { ...doneAt('09:50'), pauses: [{ from: at('10:00'), until: at('11:00') }] };

    const result = resume(state, at('11:30'));

    expect(result.state).toBe(state);
    expect(result.intents).toEqual([]);
  });
});

describe('Pause: the outstanding Reminder is dropped', () => {
  it('a fired, unanswered Reminder becomes dropped, not Missed, with its dismissal and a new chain', () => {
    const state = armed();
    const outstanding = reminderAt(state, at('09:45'));

    const result = pause(state, 'hour', at('10:00'));

    expect(reminderAt(result.state, at('09:45')).status).toBe('dropped');
    expect(result.intents).toHaveLength(2);
    expect(result.intents).toContainEqual({ type: 'DismissNotification', reminderId: outstanding.id });
    expect(timesOf(result)[0]).toBe(at('11:45'));
  });

  it('a pending Snooze re-fire is cleared and is not in the chain', () => {
    const state = snoozedAt0950();
    const outstanding = reminderAt(state, at('09:45'));
    expect(outstanding.refiresAt).toBe(at('10:00'));

    const result = pause(state, 'hour', at('09:55'));

    const dropped = reminderAt(result.state, at('09:45'));
    expect(dropped.status).toBe('dropped');
    expect(dropped.refiresAt).toBeUndefined();
    expect(result.intents).toContainEqual({ type: 'DismissNotification', reminderId: outstanding.id });
    expect(chainOf(result).map((n) => n.reminderId)).not.toContain(outstanding.id);
    expect(timesOf(result)).not.toContain(at('10:00'));
    expect(timesOf(result)[0]).toBe(at('11:40'));
  });

  it("the dropped Reminder isn't counted in today's tally, then or once settled later", () => {
    const result = pause(armed(), 'hour', at('10:00'));
    const noTally = { done: 0, skipped: 0, missed: 0, exercises: 0 };

    expect(todayTally(result.state, at('10:00'))).toEqual(noTally);
    const settled = appOpened(result.state, at('10:59')).state;
    expect(reminderAt(settled, at('09:45')).status).toBe('dropped');
    expect(todayTally(settled, at('10:59'))).toEqual(noTally);
  });
});

describe('Pause: nothing during a Pause is Missed', () => {
  it('settling at the Pause end and again later leaves no Reminder Missed', () => {
    const paused = pause(doneAt('09:50'), 'hour', at('10:00'));
    expect(paused.state.pauses).toEqual([{ from: at('10:00'), until: at('11:00') }]);

    const atEnd = appOpened(paused.state, at('11:00')).state;
    const later = appOpened(atEnd, at('11:40')).state;

    for (const s of [atEnd, later]) {
      expect(s.reminders.filter((r) => r.status === 'missed')).toEqual([]);
      expect(todayTally(s, at('11:40'))).toEqual({ done: 1, skipped: 0, missed: 0, exercises: 1 });
    }
  });

  it('a snoozed Reminder dropped by the Pause stays dropped once its re-fire time and the Pause end pass', () => {
    const paused = pause(snoozedAt0950(), 'hour', at('09:55'));

    const later = appOpened(paused.state, at('11:00')).state;

    expect(reminderAt(later, at('09:45')).status).toBe('dropped');
    expect(todayTally(later, at('11:00')).missed).toBe(0);
  });
});

describe('Resume early', () => {
  it('shortens the Pause to the Resume time, and the next Reminder is one Interval later', () => {
    const paused = pause(doneAt('09:50'), 'twoHours', at('10:00')).state;

    const result = resume(paused, at('10:40'));

    expect(result.state.pauses).toEqual([{ from: at('10:00'), until: at('10:40') }]);
    expect(intentTypes(result)).toEqual(['ScheduleChain']);
    expect(timesOf(result)[0]).toBe(at('11:25'));
  });
});

describe('Resume at the end: one Interval after the Pause ends', () => {
  it('the first Reminder is 11:45, not the old grid 11:30', () => {
    // The Done at 10:00 puts the old chain at 10:45, 11:30, 12:15, ...
    const done = doneAt('10:00');
    expect(done.reminders.map((r) => r.firesAt)).toContain(at('11:30'));

    const paused = pause(done, 'hour', at('10:00'));

    expect(timesOf(paused)).not.toContain(at('11:30'));
    expect(timesOf(paused)[0]).toBe(at('11:45'));
    // The adapter rearms at the Pause end: the same answer.
    const atEnd = rearm(paused.state, at('11:00'));
    expect(timesOf(atEnd)[0]).toBe(at('11:45'));
  });

  it('a Pause ending after the window closes leaves nothing more today; the next is Tuesday 09:45', () => {
    const result = pause(armed(), 'twoHours', at('17:00'));

    expect(result.state.pauses).toEqual([{ from: at('17:00'), until: at('19:00') }]);
    expect(timesOf(result).filter((t) => dateOf(t) === MON)).toEqual([]);
    expect(timesOf(result)[0]).toBe(local(TUE, '09:45'));
  });
});

describe('heroStatus', () => {
  it('is dayOff on a Day Off', () => {
    const state: CoreState = { ...armed(), daysOff: [{ year: 2026, month: 11, day: 2 }] };

    expect(heroStatus(state, at('10:00'))).toEqual({ kind: 'dayOff' });
  });

  it('is paused, with until, during a Pause', () => {
    const state: CoreState = { ...doneAt('09:50'), pauses: [{ from: at('10:00'), until: at('11:00') }] };

    expect(heroStatus(state, at('10:30'))).toEqual({ kind: 'paused', until: at('11:00') });
  });

  it('is next, with at, when a chain Reminder is next', () => {
    expect(heroStatus(doneAt('09:50'), at('10:00'))).toEqual({ kind: 'next', at: at('10:35'), snoozed: false });
  });

  it('is next and snoozed when the next is a Snooze re-fire', () => {
    expect(heroStatus(snoozedAt0950(), at('09:55'))).toEqual({ kind: 'next', at: at('10:00'), snoozed: true });
  });

  it('is none with nothing scheduled', () => {
    expect(heroStatus(start, at('10:00'))).toEqual({ kind: 'none' });
  });
});

describe('todaysPauses', () => {
  it("lists today's Pauses oldest first, without yesterday's", () => {
    const state: CoreState = {
      ...start,
      pauses: [
        { from: local(SUN, '15:00'), until: local(SUN, '16:00') },
        { from: at('10:00'), until: at('11:00') },
        { from: at('14:00'), until: at('15:00') },
      ],
    };

    expect(todaysPauses(state, at('16:00'))).toEqual([
      { from: at('10:00'), until: at('11:00') },
      { from: at('14:00'), until: at('15:00') },
    ]);
  });

  it('shows a resumed Pause with its shortened until', () => {
    const paused = pause(doneAt('09:50'), 'twoHours', at('10:00')).state;
    const resumed = resume(paused, at('10:40')).state;

    expect(todaysPauses(resumed, at('11:00'))).toEqual([{ from: at('10:00'), until: at('10:40') }]);
  });
});
