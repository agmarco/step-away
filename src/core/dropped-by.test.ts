import { describe, expect, it } from 'vitest';
import {
  BODY_AREAS,
  initialState,
  reduce,
  seededRandom,
  type BodyArea,
  type CoreDeps,
  type CoreState,
  type Exercise,
  type LocalDate,
  type Outcome,
  type PauseLength,
  type Reminder,
} from './index';

// All local times below are Europe/Madrid in November 2026: CET, UTC+1, no DST change.
// Default Settings: Mon-Fri 09:00-18:00, 45-minute Interval, 10-minute Snooze delay.
// A Monday 08:00 Rearm gives Monday's chain 09:45 + k·45 (09:45, 10:30, ..., 17:15).
const ZONE = 'Europe/Madrid';
const local = (date: string, time: string): number => Date.parse(`${date}T${time}:00+01:00`);
const MON = '2026-11-02';
const MONDAY: LocalDate = { year: 2026, month: 11, day: 2 };
const at = (time: string) => local(MON, time);

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
const LIBRARY: Exercise[] = BODY_AREAS.flatMap((area) => [exercise(`${slug(area)}_0`, area), exercise(`${slug(area)}_1`, area)]);

const start: CoreState = { ...initialState, settings: { ...initialState.settings, timeZone: ZONE } };

const depsAt = (when: number): CoreDeps => ({ clock: { now: () => when }, random: seededRandom(7), library: LIBRARY });
const rearm = (state: CoreState, when: number) => reduce(state, { type: 'Rearm' }, depsAt(when)).state;
const pause = (state: CoreState, length: PauseLength, when: number) =>
  reduce(state, { type: 'Pause', length }, depsAt(when)).state;
const setDayOff = (state: CoreState, off: boolean, when: number) =>
  reduce(state, { type: 'SetDayOff', date: MONDAY, off }, depsAt(when)).state;
const snooze = (state: CoreState, reminderId: string, when: number) =>
  reduce(state, { type: 'Response', reminderId, kind: 'Snooze' }, depsAt(when)).state;
const correct = (state: CoreState, reminderId: string, to: Outcome, did: string[] | undefined, when: number) =>
  reduce(state, { type: 'Correct', reminderId, to, did }, depsAt(when)).state;

const reminderAt = (state: CoreState, firesAt: number): Reminder => {
  const found = state.reminders.find((r) => r.firesAt === firesAt);
  if (!found) throw new Error(`no Reminder at ${new Date(firesAt).toISOString()}`);
  return found;
};

/** Monday: the 08:00 Rearm (chain 09:45 + k·45). */
const armed = (): CoreState => rearm(start, at('08:00'));

/** Every Reminder not `dropped` that carries `droppedBy`. */
const strayReasons = (state: CoreState) => state.reminders.filter((r) => r.status !== 'dropped' && 'droppedBy' in r);

describe('a dropped Reminder stores what dropped it', () => {
  it('a Pause drops the outstanding Reminder with droppedBy pause', () => {
    const paused = pause(armed(), 'hour', at('10:00'));

    expect(reminderAt(paused, at('09:45'))).toMatchObject({ status: 'dropped', droppedBy: 'pause' });
  });

  it('taking today off drops the outstanding Reminder with droppedBy dayOff', () => {
    const off = setDayOff(armed(), true, at('10:00'));

    expect(reminderAt(off, at('09:45'))).toMatchObject({ status: 'dropped', droppedBy: 'dayOff' });
  });

  it('a Snooze re-fire past closing settles as dropped with droppedBy closing', () => {
    const state = armed();
    // At 17:55 the 17:15 Reminder is outstanding; 17:55 + 10 = 18:05 is past the 18:00 window end.
    const snoozed = snooze(state, reminderAt(state, at('17:15')).id, at('17:55'));

    const closed = rearm(snoozed, at('18:30'));

    expect(reminderAt(closed, at('17:15'))).toMatchObject({ status: 'dropped', droppedBy: 'closing' });
  });
});

describe('the stored reason does not change after the fact', () => {
  it('a Pause drop keeps pause after a later Day Off today and its Undo', () => {
    const paused = pause(armed(), 'hour', at('10:00'));

    const off = setDayOff(paused, true, at('10:10'));
    expect(reminderAt(off, at('09:45')).droppedBy).toBe('pause');

    const undone = setDayOff(off, false, at('10:20'));
    expect(reminderAt(undone, at('09:45')).droppedBy).toBe('pause');
  });

  it('a Day Off drop keeps dayOff after its Undo and a later Pause', () => {
    const off = setDayOff(armed(), true, at('10:00'));

    const undone = setDayOff(off, false, at('10:05'));
    expect(reminderAt(undone, at('09:45')).droppedBy).toBe('dayOff');

    const paused = pause(undone, 'hour', at('10:10'));
    expect(reminderAt(paused, at('09:45')).droppedBy).toBe('dayOff');
  });
});

describe('a Correct moves a Reminder out of dropped, without its reason', () => {
  const dropped = () => pause(armed(), 'hour', at('10:00'));

  it.each<[Outcome, Reminder['status']]>([
    ['Done', 'done'],
    ['Skip', 'skipped'],
    ['Missed', 'missed'],
  ])('to %s leaves no droppedBy', (to, status) => {
    const state = dropped();
    const target = reminderAt(state, at('09:45'));
    const did = to === 'Done' ? [target.suggestion[0].id] : undefined;

    const corrected = reminderAt(correct(state, target.id, to, did, at('10:30')), at('09:45'));

    expect(corrected.status).toBe(status);
    expect(corrected).not.toHaveProperty('droppedBy');
  });
});

describe('only a dropped Reminder carries droppedBy', () => {
  it('across Snoozes, Pauses, a Day Off, its Undo, a Correct and settling', () => {
    let state = armed();
    state = snooze(state, reminderAt(state, at('09:45')).id, at('09:50'));
    state = pause(state, 'hour', at('09:55'));
    state = setDayOff(state, true, at('11:00'));
    state = setDayOff(state, false, at('11:10'));
    state = correct(state, reminderAt(state, at('09:45')).id, 'Skip', undefined, at('11:20'));
    state = rearm(state, at('18:30'));

    expect(state.reminders.some((r) => r.status !== 'dropped')).toBe(true);
    expect(strayReasons(state)).toEqual([]);
  });
});
