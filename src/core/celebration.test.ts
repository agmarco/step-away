import { describe, expect, it } from 'vitest';
import {
  initialState,
  reduce,
  seededRandom,
  type BadgeId,
  type CoreDeps,
  type CoreEvent,
  type CoreState,
  type Intent,
  type LocalDate,
  type Reminder,
  type SuggestedExercise,
} from './index';

// Local times are Europe/Madrid in October/November 2026: CET, UTC+1. 2 November 2026 is a Monday.
// Default Settings: Mon-Fri 09:00-18:00, Daily Goal 4. The library is empty, so
// no chain is built ahead: the ScheduleChain intent is always empty.
const ZONE = 'Europe/Madrid';
const local = (date: string, time: string): number => Date.parse(`${date}T${time}:00+01:00`);
const FRI_BEFORE = '2026-10-30';
const MON = '2026-11-02';
const MONDAY: LocalDate = { year: 2026, month: 11, day: 2 };

const NECK: SuggestedExercise = {
  id: 'Side_Neck_Stretch',
  name: 'Side Neck Stretch',
  dose: { kind: 'seconds', amount: 20, eachSide: true },
  cue: 'Ear to shoulder, shoulders stay down',
  bodyArea: 'Neck',
};

const reminder = (day: string, time: string, status: Reminder['status'], extra: Partial<Reminder> = {}): Reminder => ({
  id: `reminder-${local(day, time)}`,
  firesAt: local(day, time),
  suggestion: [NECK],
  status,
  ...(status === 'done' && { done: [{ id: NECK.id, name: NECK.name, bodyArea: NECK.bodyArea }] }),
  ...extra,
});
const idAt = (day: string, time: string) => `reminder-${local(day, time)}`;

const TIMES = ['09:45', '10:30', '11:15', '12:00', '12:45', '13:30', '14:15', '15:00'];
const doneOn = (day: string, count: number): Reminder[] => TIMES.slice(0, count).map((t) => reminder(day, t, 'done'));

const holding = (...ids: BadgeId[]): CoreState['badges'] =>
  ids.map((id) => ({ id, unlockedAt: local('2026-10-01', '12:00') }));

const inMadrid = (reminders: Reminder[], extra: Partial<CoreState> = {}): CoreState => ({
  ...initialState,
  settings: { ...initialState.settings, timeZone: ZONE },
  reminders: [...reminders].sort((a, b) => a.firesAt - b.firesAt),
  ...extra,
});
const plus = (state: CoreState, ...more: Reminder[]): CoreState => ({
  ...state,
  reminders: [...state.reminders, ...more].sort((a, b) => a.firesAt - b.firesAt),
});

const depsAt = (when: number): CoreDeps => ({ clock: { now: () => when }, random: seededRandom(7), library: [] });
const send = (state: CoreState, event: CoreEvent, when: number) => reduce(state, event, depsAt(when));
const doneResponse = (state: CoreState, reminderId: string, did: string[], when: number) =>
  send(state, { type: 'Response', reminderId, kind: 'Done', did }, when);
const correct = (state: CoreState, reminderId: string, to: 'Done' | 'Skip' | 'Missed', when: number, did?: string[]) =>
  send(state, { type: 'Correct', reminderId, to, ...(did && { did }) }, when);

/** The intents a final Response on `reminderId` always has, with the empty library. */
const responseIntents = (reminderId: string): Intent[] => [
  { type: 'DismissNotification', reminderId },
  { type: 'ScheduleChain', reminders: [] },
];
const celebrations = (intents: Intent[]) => intents.filter((i) => i.type === 'CelebrationDue');

describe('Celebration: a Done Response', () => {
  it('unlocking a Badge: BadgesUnlocked then CelebrationDue, after the existing intents', () => {
    const state = inMadrid([reminder(MON, '09:45', 'scheduled')]);

    const result = doneResponse(state, idAt(MON, '09:45'), [NECK.id], local(MON, '09:50'));

    expect(result.intents).toStrictEqual([
      ...responseIntents(idAt(MON, '09:45')),
      { type: 'BadgesUnlocked', badges: ['done-1'] },
      { type: 'CelebrationDue', reminderId: idAt(MON, '09:45'), goalReached: false, badges: ['done-1'] },
    ]);
  });

  it('reaching the Daily Goal: goalReached on the 4th Done with goal 4, but not on the 5th', () => {
    // A Skip earlier today, so no Perfect day: the goal alone is celebrated.
    const state = inMadrid([reminder(MON, '09:00', 'skipped'), ...doneOn(MON, 3), reminder(MON, '12:00', 'scheduled')], {
      badges: holding('done-1'),
    });

    const fourth = doneResponse(state, idAt(MON, '12:00'), [NECK.id], local(MON, '12:05'));

    expect(fourth.intents).toStrictEqual([
      ...responseIntents(idAt(MON, '12:00')),
      { type: 'CelebrationDue', reminderId: idAt(MON, '12:00'), goalReached: true, badges: [] },
    ]);

    const fifth = doneResponse(plus(fourth.state, reminder(MON, '12:50', 'scheduled')), idAt(MON, '12:50'), [NECK.id], local(MON, '12:55'));

    expect(fifth.intents).toStrictEqual(responseIntents(idAt(MON, '12:50')));
  });

  it('reaching the goal and unlocking Perfect day: both in one CelebrationDue', () => {
    const state = inMadrid([...doneOn(MON, 3), reminder(MON, '12:00', 'scheduled')], { badges: holding('done-1') });

    const result = doneResponse(state, idAt(MON, '12:00'), [NECK.id], local(MON, '12:05'));

    expect(result.intents).toStrictEqual([
      ...responseIntents(idAt(MON, '12:00')),
      { type: 'BadgesUnlocked', badges: ['perfect-day'] },
      { type: 'CelebrationDue', reminderId: idAt(MON, '12:00'), goalReached: true, badges: ['perfect-day'] },
    ]);
  });

  it('judges goalReached against today’s goal (dailyGoalFor): with goal 2, the 2nd Done', () => {
    const state = inMadrid([reminder(MON, '09:00', 'skipped'), reminder(MON, '09:45', 'done'), reminder(MON, '10:30', 'scheduled')], {
      badges: holding('done-1'),
      goalChanges: [{ from: MONDAY, goal: 2 }],
    });

    const result = doneResponse(state, idAt(MON, '10:30'), [NECK.id], local(MON, '10:35'));

    expect(celebrations(result.intents)).toStrictEqual([
      { type: 'CelebrationDue', reminderId: idAt(MON, '10:30'), goalReached: true, badges: [] },
    ]);
  });

  it('reaching nothing new: no CelebrationDue', () => {
    const first = doneResponse(inMadrid([reminder(MON, '09:45', 'scheduled')]), idAt(MON, '09:45'), [NECK.id], local(MON, '09:50'));
    expect(celebrations(first.intents)).toHaveLength(1);

    // done-1 is held now, and 2 Done is below the goal.
    const second = doneResponse(plus(first.state, reminder(MON, '10:35', 'scheduled')), idAt(MON, '10:35'), [NECK.id], local(MON, '10:40'));

    expect(second.intents).toStrictEqual(responseIntents(idAt(MON, '10:35')));
  });

  it('with no Did it (recorded as a Skip): BadgesUnlocked if any, but never CelebrationDue', () => {
    // From before Badges existed: last Friday 4 Done, so done-1 and Perfect day are waiting.
    const state = inMadrid([...doneOn(FRI_BEFORE, 4), reminder(MON, '09:45', 'scheduled')]);

    const result = doneResponse(state, idAt(MON, '09:45'), [], local(MON, '09:50'));

    expect(result.intents).toStrictEqual([
      ...responseIntents(idAt(MON, '09:45')),
      { type: 'BadgesUnlocked', badges: ['done-1', 'perfect-day'] },
    ]);
  });
});

describe('Celebration: a Skip Response never celebrates', () => {
  it('even when it unlocks Badges', () => {
    const state = inMadrid([...doneOn(FRI_BEFORE, 4), reminder(MON, '09:45', 'scheduled')]);

    const result = send(state, { type: 'Response', reminderId: idAt(MON, '09:45'), kind: 'Skip' }, local(MON, '09:50'));

    expect(result.intents).toStrictEqual([
      ...responseIntents(idAt(MON, '09:45')),
      { type: 'BadgesUnlocked', badges: ['done-1', 'perfect-day'] },
    ]);
  });
});

describe('Celebration: a Correct', () => {
  it('to Done that reaches the goal (a late guided finish): CelebrationDue with the corrected Reminder', () => {
    // Monday evening: 3 Done and a skipped one; correcting it reaches 4, all Done.
    const state = inMadrid([...doneOn(MON, 3), reminder(MON, '12:00', 'skipped')], { badges: holding('done-1') });

    const result = correct(state, idAt(MON, '12:00'), 'Done', local(MON, '20:00'), [NECK.id]);

    expect(result.intents).toStrictEqual([
      { type: 'BadgesUnlocked', badges: ['perfect-day'] },
      { type: 'CelebrationDue', reminderId: idAt(MON, '12:00'), goalReached: true, badges: ['perfect-day'] },
    ]);
  });

  it('to Done reaching nothing new has no intents; the one that reaches the goal celebrates', () => {
    const state = inMadrid([...doneOn(MON, 2), reminder(MON, '11:15', 'missed'), reminder(MON, '12:00', 'missed')], {
      badges: holding('done-1'),
    });

    const third = correct(state, idAt(MON, '11:15'), 'Done', local(MON, '20:00'), [NECK.id]);
    expect(third.intents).toStrictEqual([]);

    const fourth = correct(third.state, idAt(MON, '12:00'), 'Done', local(MON, '20:01'), [NECK.id]);
    expect(celebrations(fourth.intents)).toStrictEqual([
      { type: 'CelebrationDue', reminderId: idAt(MON, '12:00'), goalReached: true, badges: ['perfect-day'] },
    ]);
  });

  it('Done to Done at the goal already: not a transition, no CelebrationDue', () => {
    // Monday already at 4 Done; a Missed later keeps it from being a Perfect day.
    const state = inMadrid([...doneOn(MON, 4), reminder(MON, '12:45', 'missed')], { badges: holding('done-1') });

    const relisted = correct(state, idAt(MON, '09:45'), 'Done', local(MON, '20:00'), [NECK.id]);
    expect(relisted.intents).toStrictEqual([]);

    // Back below the goal, then up again: that is a transition.
    const below = correct(relisted.state, idAt(MON, '09:45'), 'Skip', local(MON, '20:01'));
    const again = correct(below.state, idAt(MON, '09:45'), 'Done', local(MON, '20:02'), [NECK.id]);
    expect(again.intents).toStrictEqual([
      { type: 'CelebrationDue', reminderId: idAt(MON, '09:45'), goalReached: true, badges: [] },
    ]);
  });

  it('to Skip or Missed never celebrates, even when it unlocks Badges', () => {
    const state = inMadrid([...doneOn(FRI_BEFORE, 4), reminder(MON, '09:45', 'done')]);

    const result = correct(state, idAt(MON, '09:45'), 'Skip', local(MON, '20:00'));

    expect(result.intents).toStrictEqual([{ type: 'BadgesUnlocked', badges: ['done-1', 'perfect-day'] }]);
  });
});
