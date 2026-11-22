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
// A Monday Rearm before opening gives Monday's chain 09:45 + k·45 (09:45, 10:30, ..., 17:15).
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

/** Monday: a Rearm at `when` (before opening: chain 09:45 + k·45). */
const armedAt = (when: string): CoreState => reduce(start, { type: 'Rearm' }, depsAt(at(when))).state;
const armed = () => armedAt('08:00');

/** Monday: the 08:00 Rearm, then a Done at `when` on the 09:45 Reminder. The chain runs `when` + k·45. */
const doneAt = (when: string): CoreState => {
  const s = armed();
  const first = reminderAt(s, at('09:45'));
  return reduce(s, { type: 'Response', reminderId: first.id, kind: 'Done', did: [first.suggestion[0].id] }, depsAt(at(when)))
    .state;
};

describe('canPause: Pause is offered only when it does something', () => {
  it('is true before opening, with the next Reminder (09:45) today', () => {
    expect(canPause(armedAt('07:00'), at('07:00'))).toBe(true);
  });

  it("is false after the day's last Reminder, with nothing outstanding and the next tomorrow (Tue 09:45)", () => {
    // 17:15 was Missed at closing (18:00), so nothing is left for a Pause to drop.
    expect(canPause(armed(), at('18:30'))).toBe(false);
  });

  it('is true with a Reminder outstanding while the next is tomorrow: the Pause drops it', () => {
    // The Done at 10:10 puts the chain at 10:55, ..., 17:40; 18:25 is past closing, so the next is Tue 09:45.
    expect(canPause(doneAt('10:10'), at('17:50'))).toBe(true);
  });

  it('is true inside the window with nothing outstanding and the next Reminder (10:35) today', () => {
    expect(canPause(doneAt('09:50'), at('10:00'))).toBe(true);
  });

  it('is true when the next is a Snooze re-fire today', () => {
    // A Snooze at 09:50 on the 09:45 Reminder: the next is its 10:00 re-fire.
    const s = armed();
    const snoozed = reduce(s, { type: 'Response', reminderId: reminderAt(s, at('09:45')).id, kind: 'Snooze' }, depsAt(at('09:50')))
      .state;

    expect(canPause(snoozed, at('09:55'))).toBe(true);
  });

  it('is false on a Day Off, even with a Reminder ahead today', () => {
    const state: CoreState = { ...armed(), daysOff: [{ year: 2026, month: 11, day: 2 }] };

    expect(canPause(state, at('10:00'))).toBe(false);
  });

  it('is false while a Pause is running', () => {
    const paused = reduce(armed(), { type: 'Pause', length: 'hour' }, depsAt(at('10:00'))).state;

    expect(canPause(paused, at('10:30'))).toBe(false);
  });

  it('is true with nothing scheduled while a Reminder is outstanding: the Pause drops it', () => {
    // At 17:20 the 17:15 Reminder is outstanding and the next 7 days (Tue 3 to Mon 9) are Days Off.
    let state = armed();
    for (let day = 3; day <= 9; day++) {
      state = reduce(state, { type: 'SetDayOff', date: { year: 2026, month: 11, day }, off: true }, depsAt(at('17:20'))).state;
    }

    expect(heroStatus(state, at('17:20')).kind).toBe('none');
    expect(outstandingReminder(state, at('17:20'))?.firesAt).toBe(at('17:15'));
    expect(canPause(state, at('17:20'))).toBe(true);
  });

  it('is false with nothing scheduled', () => {
    expect(canPause(start, at('10:00'))).toBe(false);
  });
});
