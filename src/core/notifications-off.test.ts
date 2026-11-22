import { describe, expect, it } from 'vitest';
import {
  BODY_AREAS,
  canPause,
  heroStatus,
  initialState,
  outstandingReminder,
  reduce,
  seededRandom,
  type BodyArea,
  type CoreDeps,
  type CoreState,
  type Exercise,
  type Reminder,
} from './index';

// All local times below are Europe/Madrid in November 2026: CET, UTC+1, no DST change.
// Default Settings: Mon-Fri 09:00-18:00, 45-minute Interval, 10-minute Snooze delay.
// A Monday 08:00 Rearm gives Monday's chain 09:45 + k·45 (09:45, 10:30, ..., 17:15).
const ZONE = 'Europe/Madrid';
const MON = '2026-11-02';
const at = (time: string): number => Date.parse(`${MON}T${time}:00+01:00`);

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
const reminderAt = (state: CoreState, firesAt: number): Reminder => {
  const found = state.reminders.find((r) => r.firesAt === firesAt);
  if (!found) throw new Error(`no Reminder at ${new Date(firesAt).toISOString()}`);
  return found;
};

/** Monday: the 08:00 Rearm (chain 09:45 + k·45). */
const armed = (): CoreState => reduce(start, { type: 'Rearm' }, depsAt(at('08:00'))).state;

/** Monday: the 08:00 Rearm, then a Done at 09:50 on the 09:45 Reminder. The chain runs 10:35 + k·45. */
const doneAt0950 = (): CoreState => {
  const s = armed();
  const first = reminderAt(s, at('09:45'));
  return reduce(s, { type: 'Response', reminderId: first.id, kind: 'Done', did: [first.suggestion[0].id] }, depsAt(at('09:50')))
    .state;
};

/** `doneAt0950`, with a Pause running 10:00-11:00. */
const pausedTill11 = (): CoreState => ({ ...doneAt0950(), pauses: [{ from: at('10:00'), until: at('11:00') }] });

describe('heroStatus with notifications blocked: "Reminders are off" overrides every other status', () => {
  it('is off with the next Reminder ahead', () => {
    expect(heroStatus(doneAt0950(), at('10:00'), 'blocked')).toEqual({ kind: 'off' });
  });

  it('is off while a Pause is running', () => {
    expect(heroStatus(pausedTill11(), at('10:30'), 'blocked')).toEqual({ kind: 'off' });
  });

  it('is off on a Day Off', () => {
    const state: CoreState = { ...armed(), daysOff: [{ year: 2026, month: 11, day: 2 }] };

    expect(heroStatus(state, at('10:00'), 'blocked')).toEqual({ kind: 'off' });
  });

  it('is off with nothing scheduled', () => {
    expect(heroStatus(start, at('10:00'), 'blocked')).toEqual({ kind: 'off' });
  });
});

describe('heroStatus with notifications allowed, or not given: unchanged', () => {
  it.each([['allowed' as const], [undefined]])('is next, with at, when a chain Reminder is next (%s)', (notifications) => {
    expect(heroStatus(doneAt0950(), at('10:00'), notifications)).toEqual({ kind: 'next', at: at('10:35'), snoozed: false });
  });

  it.each([['allowed' as const], [undefined]])('is paused, with until, during a Pause (%s)', (notifications) => {
    expect(heroStatus(pausedTill11(), at('10:30'), notifications)).toEqual({ kind: 'paused', until: at('11:00') });
  });
});

describe('canPause with notifications blocked', () => {
  // At 10:00 the 09:45 Reminder is outstanding and the next (10:30) is today.
  it('is true with a Reminder outstanding and the next today, when notifications are allowed', () => {
    const state = armed();

    expect(outstandingReminder(state, at('10:00'))?.firesAt).toBe(at('09:45'));
    expect(heroStatus(state, at('10:00'), 'allowed')).toEqual({ kind: 'next', at: at('10:30'), snoozed: false });
    expect(canPause(state, at('10:00'), heroStatus(state, at('10:00'), 'allowed'))).toBe(true);
  });

  it('is false under off, in the same state: the hero offers no Pause', () => {
    const state = armed();

    expect(canPause(state, at('10:00'), heroStatus(state, at('10:00'), 'blocked'))).toBe(false);
  });

  it('is false when given the off status directly, even with a Reminder outstanding', () => {
    expect(canPause(armed(), at('10:00'), { kind: 'off' })).toBe(false);
  });
});
