import { describe, expect, it } from 'vitest';
import {
  initialState,
  records,
  reduce,
  seededRandom,
  streak,
  type CoreDeps,
  type CoreEvent,
  type CoreState,
  type LocalDate,
  type Reminder,
  type SuggestedExercise,
} from './index';

// Local times are Europe/Madrid in October/November 2026: CET, UTC+1 (DST ended
// on 25 October). 26 October and 2 November 2026 are Mondays.
// Default Settings: Mon-Fri 09:00-18:00, weekends without Active Hours, Daily Goal 4.
const ZONE = 'Europe/Madrid';
const local = (date: string, time: string): number => Date.parse(`${date}T${time}:00+01:00`);
const date = (iso: string): LocalDate => {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
};

const TUE_BEFORE = '2026-10-27';
const WED_BEFORE = '2026-10-28';
const THU_BEFORE = '2026-10-29';
const FRI_BEFORE = '2026-10-30';
const SUN_BEFORE = '2026-11-01';
const MON = '2026-11-02';
const TUE = '2026-11-03';
const WED = '2026-11-04';
const THU = '2026-11-05';
const FRI = '2026-11-06';
const NEXT_MON = '2026-11-09';
const NEXT_TUE = '2026-11-10';

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

const inMadrid = (reminders: Reminder[], extra: Partial<CoreState> = {}): CoreState => ({
  ...initialState,
  settings: { ...initialState.settings, timeZone: ZONE },
  reminders: [...reminders].sort((a, b) => a.firesAt - b.firesAt),
  ...extra,
});

const depsAt = (when: number): CoreDeps => ({ clock: { now: () => when }, random: seededRandom(7), library: [] });
const send = (state: CoreState, event: CoreEvent, when: number) => reduce(state, event, depsAt(when));

describe('Records: an empty Activity Log', () => {
  it('has every Record at 0', () => {
    expect(records(initialState, local(MON, '12:00'))).toStrictEqual({ longestStreak: 0, mostDoneInDay: 0, mostDoneInWeek: 0 });
  });
});

describe('Records: longest Streak', () => {
  it('finds a past run longer than the current Streak', () => {
    // Tue-Thu before: 3 Goal Days; Friday 1 Done ends the run; (Sat, Sun);
    // Mon, Tue: 2 Goal Days; Wednesday (today) not a Goal Day yet.
    const state = inMadrid([
      ...doneOn(TUE_BEFORE, 4),
      ...doneOn(WED_BEFORE, 4),
      ...doneOn(THU_BEFORE, 4),
      ...doneOn(FRI_BEFORE, 1),
      ...doneOn(MON, 4),
      ...doneOn(TUE, 4),
      reminder(WED, '09:45', 'done'),
    ]);
    const now = local(WED, '10:00');

    expect(streak(state, now)).toBe(2);
    expect(records(state, now).longestStreak).toBe(3);
  });

  it('is never less than the current Streak, and a today not yet a Goal Day doesn’t end the run', () => {
    const state = inMadrid([...doneOn(MON, 4), ...doneOn(TUE, 4), ...doneOn(WED, 3)]);

    // Wednesday at 3 of 4: the run Mon, Tue stands.
    expect(records(state, local(WED, '12:30')).longestStreak).toBe(2);
    expect(streak(state, local(WED, '12:30'))).toBe(2);

    // Wednesday reaching its goal extends it.
    const reached = inMadrid([...doneOn(MON, 4), ...doneOn(TUE, 4), ...doneOn(WED, 4)]);
    expect(records(reached, local(WED, '12:30')).longestStreak).toBe(3);
    expect(streak(reached, local(WED, '12:30'))).toBe(3);
  });

  it('skips weekends and Days Off, even a Day Off that reached its goal', () => {
    // Thu, (Fri off, 4 Done anyway), (Sat, Sun), Mon, Tue: a run of 3, not 4.
    const reminders = [...doneOn(THU, 4), ...doneOn(FRI, 4), ...doneOn(NEXT_MON, 4), ...doneOn(NEXT_TUE, 4)];
    const now = local(NEXT_TUE, '18:30');

    expect(records(inMadrid(reminders, { daysOff: [date(FRI)] }), now).longestStreak).toBe(3);
    // The control: without the Day Off, Friday counts: 4.
    expect(records(inMadrid(reminders), now).longestStreak).toBe(4);

    // A Day Off with nothing done neither breaks nor extends it.
    const fridayEmpty = [...doneOn(THU, 4), ...doneOn(NEXT_MON, 4), ...doneOn(NEXT_TUE, 4)];
    expect(records(inMadrid(fridayEmpty, { daysOff: [date(FRI)] }), now).longestStreak).toBe(3);
    // The control: without it, Friday (Active Hours, no Done) ends the run: 2.
    expect(records(inMadrid(fridayEmpty), now).longestStreak).toBe(2);
  });
});

describe('Records: most Done', () => {
  it('in a day: the most Done Reminders in any one day; skipped, Missed and dropped ones don’t count', () => {
    const state = inMadrid([
      ...doneOn(MON, 3),
      ...doneOn(TUE, 5),
      reminder(TUE, '16:00', 'skipped'),
      reminder(TUE, '16:45', 'missed'),
      ...doneOn(WED, 2),
      reminder(WED, '13:30', 'skipped'),
      reminder(WED, '14:15', 'missed'),
      reminder(WED, '15:00', 'dropped', { droppedBy: 'pause' }),
      reminder(WED, '15:45', 'missed'),
      reminder(WED, '16:30', 'missed'),
    ]);

    expect(records(state, local(WED, '18:30')).mostDoneInDay).toBe(5);
  });

  it('in a week: local Mon-Sun weeks, so a Sunday and the following Monday are in different weeks', () => {
    // Sunday with Active Hours, so it has Reminders.
    const settings = { ...initialState.settings, timeZone: ZONE };
    const withSunday = { ...settings, activeHours: { ...settings.activeHours, sun: { start: 9 * 60, end: 18 * 60 } } };
    // Week of 26 Oct: Fri 3 + Sun 2 = 5. Week of 2 Nov: Mon 4.
    // (Sun-Sat weeks would give 3 and 2 + 4 = 6; a rolling 7 days, 3 + 2 + 4 = 9.)
    const state = { ...inMadrid([...doneOn(FRI_BEFORE, 3), ...doneOn(SUN_BEFORE, 2), ...doneOn(MON, 4)]), settings: withSunday };

    expect(records(state, local(MON, '18:30')).mostDoneInWeek).toBe(5);
  });
});

describe('Records: recalculated, unlike Badges', () => {
  it('go down after a correction while the Badges stay', () => {
    // Last Friday 4 Done; Monday 4 Done and the 12:45 Reminder outstanding.
    const state = inMadrid([...doneOn(FRI_BEFORE, 4), ...doneOn(MON, 4), reminder(MON, '12:45', 'scheduled')]);
    const fifth = send(state, { type: 'Response', reminderId: idAt(MON, '12:45'), kind: 'Done', did: [NECK.id] }, local(MON, '12:50'));
    const badges = fifth.state.badges;
    expect(badges.map((b) => b.id)).toStrictEqual(['done-1', 'perfect-day']);

    const evening = local(MON, '20:00');
    // Fri, Mon: 2. Monday 5 Done, in a week of its own.
    expect(records(fifth.state, evening)).toStrictEqual({ longestStreak: 2, mostDoneInDay: 5, mostDoneInWeek: 5 });

    const one = send(fifth.state, { type: 'Correct', reminderId: idAt(MON, '09:45'), to: 'Skip' }, evening).state;
    const two = send(one, { type: 'Correct', reminderId: idAt(MON, '10:30'), to: 'Missed' }, evening).state;

    // Monday 3 Done: no longer a Goal Day, so the Streak run is Friday alone; Friday's 4 is the best day and week.
    expect(records(two, evening)).toStrictEqual({ longestStreak: 1, mostDoneInDay: 4, mostDoneInWeek: 4 });
    expect(two.badges).toStrictEqual(badges);
  });
});
