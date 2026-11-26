import { describe, expect, it } from 'vitest';
import {
  BADGES,
  initialState,
  reduce,
  seededRandom,
  type BadgeId,
  type BodyArea,
  type CoreDeps,
  type CoreEvent,
  type CoreResult,
  type CoreState,
  type DoneExercise,
  type Exercise,
  type Intent,
  type LocalDate,
  type Reminder,
  type SuggestedExercise,
} from './index';

// Local times are Europe/Madrid in October/November 2026: CET, UTC+1 (DST ended
// on 25 October). 2 November 2026 is a Monday.
// Default Settings: Mon-Fri 09:00-18:00, weekends without Active Hours, Daily Goal 4.
const ZONE = 'Europe/Madrid';
const local = (date: string, time: string): number => Date.parse(`${date}T${time}:00+01:00`);
const date = (iso: string): LocalDate => {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
};

const FRI_BEFORE = '2026-10-30';
const MON = '2026-11-02';
const TUE = '2026-11-03';
const WED = '2026-11-04';
const THU = '2026-11-05';
const FRI = '2026-11-06';
const NEXT_MON = '2026-11-09';
const NEXT_TUE = '2026-11-10';

/** A suggested Exercise named after its Id. */
const suggested = (id: string, bodyArea: BodyArea = 'Neck'): SuggestedExercise => ({
  id,
  name: id,
  dose: { kind: 'reps', amount: 10, eachSide: false },
  cue: `${id} cue`,
  bodyArea,
});
const snapshot = ({ id, name, bodyArea }: SuggestedExercise): DoneExercise => ({ id, name, bodyArea });

const NECK = suggested('Side_Neck_Stretch', 'Neck');

/**
 * A Reminder of `day` at `time` suggesting `suggestion` (the Side Neck Stretch
 * by default); a Done one did the whole Suggestion unless `extra` says otherwise.
 */
const reminder = (
  day: string,
  time: string,
  status: Reminder['status'],
  extra: Partial<Reminder> = {},
): Reminder => {
  const suggestion = extra.suggestion ?? [NECK];
  return {
    id: `reminder-${local(day, time)}`,
    firesAt: local(day, time),
    suggestion,
    status,
    ...(status === 'done' && { done: suggestion.map(snapshot) }),
    ...extra,
  };
};
const idAt = (day: string, time: string) => `reminder-${local(day, time)}`;

// The no-Response chain of a weekday: 09:45 + k·45.
const TIMES = ['09:45', '10:30', '11:15', '12:00', '12:45', '13:30', '14:15', '15:00'];
/** `count` Done Reminders on `day`, from 09:45 one Interval apart. */
const doneOn = (day: string, count: number): Reminder[] => TIMES.slice(0, count).map((t) => reminder(day, t, 'done'));

/** Badges held since well before the fixtures' days. */
const HELD_SINCE = local('2026-10-01', '12:00');
const holding = (...ids: BadgeId[]): CoreState['badges'] => ids.map((id) => ({ id, unlockedAt: HELD_SINCE }));

const inMadrid = (reminders: Reminder[], extra: Partial<CoreState> = {}): CoreState => ({
  ...initialState,
  settings: { ...initialState.settings, timeZone: ZONE },
  reminders: [...reminders].sort((a, b) => a.firesAt - b.firesAt),
  ...extra,
});
/** `state` with `more` Reminders added, e.g. the next outstanding one (the empty library builds no chain). */
const plus = (state: CoreState, ...more: Reminder[]): CoreState => ({
  ...state,
  reminders: [...state.reminders, ...more].sort((a, b) => a.firesAt - b.firesAt),
});

const depsAt = (when: number, library: readonly Exercise[] = []): CoreDeps => ({
  clock: { now: () => when },
  random: seededRandom(7),
  library,
});
const send = (state: CoreState, event: CoreEvent, when: number, library?: readonly Exercise[]) =>
  reduce(state, event, depsAt(when, library));
const doneResponse = (state: CoreState, reminderId: string, did: string[], when: number) =>
  send(state, { type: 'Response', reminderId, kind: 'Done', did }, when);
const skipResponse = (state: CoreState, reminderId: string, when: number) =>
  send(state, { type: 'Response', reminderId, kind: 'Skip' }, when);
const correct = (state: CoreState, reminderId: string, to: 'Done' | 'Skip' | 'Missed', when: number, did?: string[]) =>
  send(state, { type: 'Correct', reminderId, to, ...(did && { did }) }, when);

const ids = (state: CoreState): BadgeId[] => state.badges.map((b) => b.id);
const unlockedIntents = (result: CoreResult): Intent[] => result.intents.filter((i) => i.type === 'BadgesUnlocked');

describe('Badges: the catalogue', () => {
  it('lists every Badge in order, with its group and its threshold where it has one', () => {
    expect(BADGES).toStrictEqual([
      { id: 'streak-3', group: 'Streak', threshold: 3 },
      { id: 'streak-7', group: 'Streak', threshold: 7 },
      { id: 'streak-14', group: 'Streak', threshold: 14 },
      { id: 'streak-30', group: 'Streak', threshold: 30 },
      { id: 'streak-60', group: 'Streak', threshold: 60 },
      { id: 'streak-100', group: 'Streak', threshold: 100 },
      { id: 'done-1', group: 'Total Done', threshold: 1 },
      { id: 'done-10', group: 'Total Done', threshold: 10 },
      { id: 'done-50', group: 'Total Done', threshold: 50 },
      { id: 'done-100', group: 'Total Done', threshold: 100 },
      { id: 'done-250', group: 'Total Done', threshold: 250 },
      { id: 'done-500', group: 'Total Done', threshold: 500 },
      { id: 'variety-10', group: 'Variety', threshold: 10 },
      { id: 'variety-25', group: 'Variety', threshold: 25 },
      { id: 'variety-50', group: 'Variety', threshold: 50 },
      { id: 'balance', group: 'One-day' },
      { id: 'perfect-day', group: 'One-day' },
    ]);
  });
});

describe('Badges: Total Done', () => {
  it('unlocks done-1 on the first Done, at the Response time', () => {
    const state = inMadrid([reminder(MON, '09:45', 'scheduled')]);

    const result = doneResponse(state, idAt(MON, '09:45'), [NECK.id], local(MON, '09:50'));

    expect(result.state.badges).toStrictEqual([{ id: 'done-1', unlockedAt: local(MON, '09:50') }]);
    expect(unlockedIntents(result)).toStrictEqual([{ type: 'BadgesUnlocked', badges: ['done-1'] }]);
  });

  it('unlocks done-10 at the 10th Done, not at the 9th', () => {
    // 2 Done a day Mon-Thu (no Goal Day, so no Streak or Perfect day): 8 Done.
    const eight = inMadrid([...doneOn(MON, 2), ...doneOn(TUE, 2), ...doneOn(WED, 2), ...doneOn(THU, 2)], {
      badges: holding('done-1'),
    });

    const ninth = doneResponse(plus(eight, reminder(FRI, '09:45', 'scheduled')), idAt(FRI, '09:45'), [NECK.id], local(FRI, '09:50'));

    expect(ninth.state.badges).toStrictEqual(holding('done-1'));
    expect(unlockedIntents(ninth)).toEqual([]);

    const tenth = doneResponse(
      plus(ninth.state, reminder(FRI, '10:35', 'scheduled')),
      idAt(FRI, '10:35'),
      [NECK.id],
      local(FRI, '10:40'),
    );

    expect(tenth.state.badges).toStrictEqual([...holding('done-1'), { id: 'done-10', unlockedAt: local(FRI, '10:40') }]);
    expect(unlockedIntents(tenth)).toStrictEqual([{ type: 'BadgesUnlocked', badges: ['done-10'] }]);
  });
});

describe('Badges: Streak', () => {
  // Everything else these fixtures reach is already held.
  const HELD = holding('done-1', 'done-10', 'perfect-day');

  it('unlocks streak-3 on the Done that makes the third Goal Day in a row', () => {
    const state = inMadrid([...doneOn(MON, 4), ...doneOn(TUE, 4), ...doneOn(WED, 3), reminder(WED, '12:00', 'scheduled')], {
      badges: HELD,
    });

    const result = doneResponse(state, idAt(WED, '12:00'), [NECK.id], local(WED, '12:05'));

    expect(result.state.badges).toStrictEqual([...HELD, { id: 'streak-3', unlockedAt: local(WED, '12:05') }]);
    expect(unlockedIntents(result)).toStrictEqual([{ type: 'BadgesUnlocked', badges: ['streak-3'] }]);
  });

  it('skips weekends and Days Off: Wed, (Thu off), Fri, (Sat, Sun), Mon is a run of 3', () => {
    const reminders = [...doneOn(WED, 4), ...doneOn(FRI, 4), ...doneOn(NEXT_MON, 3), reminder(NEXT_MON, '12:00', 'scheduled')];
    const thursdayOff = inMadrid(reminders, { badges: HELD, daysOff: [date(THU)] });

    const result = doneResponse(thursdayOff, idAt(NEXT_MON, '12:00'), [NECK.id], local(NEXT_MON, '12:05'));

    expect(ids(result.state)).toStrictEqual([...ids(thursdayOff), 'streak-3']);

    // Without the Day Off, Thursday (Active Hours, no Done) ends the run: Fri, Mon is 2.
    const thursdayOn = inMadrid(reminders, { badges: HELD });
    const without = doneResponse(thursdayOn, idAt(NEXT_MON, '12:00'), [NECK.id], local(NEXT_MON, '12:05'));
    expect(ids(without.state)).toStrictEqual(ids(thursdayOn));
  });

  it('unlocks streak-7 on the seventh Goal Day in a row, across a weekend', () => {
    // Mon-Fri, (Sat, Sun), Mon, and Tue reaching its goal: 7.
    const held = holding('streak-3', 'done-1', 'done-10', 'perfect-day');
    const state = inMadrid(
      [
        ...[MON, TUE, WED, THU, FRI, NEXT_MON].flatMap((day) => doneOn(day, 4)),
        ...doneOn(NEXT_TUE, 3),
        reminder(NEXT_TUE, '12:00', 'scheduled'),
      ],
      { badges: held },
    );

    const result = doneResponse(state, idAt(NEXT_TUE, '12:00'), [NECK.id], local(NEXT_TUE, '12:05'));

    expect(result.state.badges).toStrictEqual([...held, { id: 'streak-7', unlockedAt: local(NEXT_TUE, '12:05') }]);
  });

  it('counts a past run longer than the current Streak, and unlocks in catalogue order', () => {
    // From before Badges existed: Mon-Wed Goal Days (12 Done), Thursday Missed,
    // so the current Streak is 0. A Skip on Friday evaluates too.
    const state = inMadrid([
      ...doneOn(MON, 4),
      ...doneOn(TUE, 4),
      ...doneOn(WED, 4),
      reminder(THU, '09:45', 'missed'),
      reminder(FRI, '09:45', 'scheduled'),
    ]);

    const result = skipResponse(state, idAt(FRI, '09:45'), local(FRI, '09:50'));

    const at = local(FRI, '09:50');
    expect(result.state.badges).toStrictEqual([
      { id: 'streak-3', unlockedAt: at },
      { id: 'done-1', unlockedAt: at },
      { id: 'done-10', unlockedAt: at },
      { id: 'perfect-day', unlockedAt: at },
    ]);
    expect(unlockedIntents(result)).toStrictEqual([
      { type: 'BadgesUnlocked', badges: ['streak-3', 'done-1', 'done-10', 'perfect-day'] },
    ]);
  });
});

describe('Badges: Variety', () => {
  const ex = (id: string) => suggested(id);

  it('counts distinct Exercise Ids across every done list: a repeat adds nothing, the 10th distinct unlocks', () => {
    // 9 distinct Ids (A-I) over 4 Done, A and B done twice; 2 Done a day, all Neck.
    const state = inMadrid(
      [
        reminder(MON, '09:45', 'done', { suggestion: [ex('A'), ex('B'), ex('C')] }),
        reminder(MON, '10:30', 'done', { suggestion: [ex('A'), ex('D')] }),
        reminder(TUE, '09:45', 'done', { suggestion: [ex('E'), ex('F'), ex('G')] }),
        reminder(TUE, '10:30', 'done', { suggestion: [ex('B'), ex('H'), ex('I')] }),
        // J is suggested but only A is done: a suggested Id doesn't count.
        reminder(WED, '09:45', 'scheduled', { suggestion: [ex('A'), ex('J')] }),
      ],
      { badges: holding('done-1') },
    );

    const repeat = doneResponse(state, idAt(WED, '09:45'), ['A'], local(WED, '09:50'));

    expect(repeat.state.badges).toStrictEqual(holding('done-1'));
    expect(unlockedIntents(repeat)).toEqual([]);

    const tenth = doneResponse(
      plus(repeat.state, reminder(WED, '10:35', 'scheduled', { suggestion: [ex('J')] })),
      idAt(WED, '10:35'),
      ['J'],
      local(WED, '10:40'),
    );

    expect(tenth.state.badges).toStrictEqual([...holding('done-1'), { id: 'variety-10', unlockedAt: local(WED, '10:40') }]);
  });
});

describe('Badges: Balance', () => {
  const NECK_E = suggested('Neck_1', 'Neck');
  const SHOULDERS = suggested('Shoulders_1', 'Shoulders & Upper Back');
  const CHEST = suggested('Chest_1', 'Chest & Arms');
  const WRISTS = suggested('Wrists_1', 'Wrists & Forearms');
  const CORE = suggested('Core_1', 'Core & Lower Back');
  const LEGS = suggested('Legs_1', 'Hips & Legs');

  it('unlocks when one day’s done lists cover all six Body Areas', () => {
    const state = inMadrid(
      [
        reminder(MON, '09:45', 'done', { suggestion: [NECK_E, SHOULDERS, CHEST] }),
        reminder(MON, '10:30', 'scheduled', { suggestion: [WRISTS, CORE, LEGS] }),
      ],
      { badges: holding('done-1') },
    );

    const result = doneResponse(state, idAt(MON, '10:30'), [WRISTS.id, CORE.id, LEGS.id], local(MON, '10:35'));

    expect(result.state.badges).toStrictEqual([...holding('done-1'), { id: 'balance', unlockedAt: local(MON, '10:35') }]);
  });

  it('does not unlock with the six areas spread over two days', () => {
    const state = inMadrid(
      [
        reminder(MON, '09:45', 'done', { suggestion: [NECK_E, SHOULDERS, CHEST] }),
        reminder(TUE, '09:45', 'scheduled', { suggestion: [WRISTS, CORE, LEGS] }),
      ],
      { badges: holding('done-1') },
    );

    const result = doneResponse(state, idAt(TUE, '09:45'), [WRISTS.id, CORE.id, LEGS.id], local(TUE, '09:50'));

    expect(result.state.badges).toStrictEqual(holding('done-1'));
    expect(unlockedIntents(result)).toEqual([]);

    // The control: the same Exercises on one day unlock it.
    const oneDay = doneResponse(
      plus(result.state, reminder(TUE, '10:35', 'scheduled', { suggestion: [NECK_E, SHOULDERS, CHEST] })),
      idAt(TUE, '10:35'),
      [NECK_E.id, SHOULDERS.id, CHEST.id],
      local(TUE, '10:40'),
    );
    expect(ids(oneDay.state)).toStrictEqual(['done-1', 'balance']);
  });

  it('counts only the Exercises marked Did it, not the rest of the Suggestion', () => {
    const state = inMadrid(
      [
        reminder(MON, '09:45', 'done', { suggestion: [NECK_E, SHOULDERS, CHEST] }),
        reminder(MON, '10:30', 'scheduled', { suggestion: [WRISTS, CORE, LEGS] }),
      ],
      { badges: holding('done-1') },
    );

    // Hips & Legs is suggested but not done.
    const result = doneResponse(state, idAt(MON, '10:30'), [WRISTS.id, CORE.id], local(MON, '10:35'));

    expect(result.state.badges).toStrictEqual(holding('done-1'));

    const legs = doneResponse(
      plus(result.state, reminder(MON, '11:20', 'scheduled', { suggestion: [LEGS] })),
      idAt(MON, '11:20'),
      [LEGS.id],
      local(MON, '11:25'),
    );
    expect(ids(legs.state)).toStrictEqual(['done-1', 'balance']);
  });
});

describe('Badges: Perfect day', () => {
  const HELD = holding('done-1');

  it('unlocks on the Done that reaches today’s Daily Goal with nothing skipped or Missed today', () => {
    const state = inMadrid([...doneOn(MON, 3), reminder(MON, '12:00', 'scheduled')], { badges: HELD });

    const result = doneResponse(state, idAt(MON, '12:00'), [NECK.id], local(MON, '12:05'));

    expect(result.state.badges).toStrictEqual([...HELD, { id: 'perfect-day', unlockedAt: local(MON, '12:05') }]);
  });

  it('does not unlock with a Skip today, even at the goal', () => {
    const state = inMadrid([reminder(MON, '09:00', 'skipped'), ...doneOn(MON, 3), reminder(MON, '12:00', 'scheduled')], {
      badges: HELD,
    });

    const result = doneResponse(state, idAt(MON, '12:00'), [NECK.id], local(MON, '12:05'));

    expect(result.state.badges).toStrictEqual(HELD);
    expect(unlockedIntents(result)).toEqual([]);

    // The control: correcting the Skip to Done makes it a Perfect day.
    const corrected = correct(result.state, idAt(MON, '09:00'), 'Done', local(MON, '12:10'), [NECK.id]);
    expect(ids(corrected.state)).toStrictEqual(['done-1', 'perfect-day']);
  });

  it('does not unlock with a Missed Reminder today, even at the goal', () => {
    const state = inMadrid([reminder(MON, '09:00', 'missed'), ...doneOn(MON, 3), reminder(MON, '12:00', 'scheduled')], {
      badges: HELD,
    });

    const result = doneResponse(state, idAt(MON, '12:00'), [NECK.id], local(MON, '12:05'));

    expect(result.state.badges).toStrictEqual(HELD);

    const corrected = correct(result.state, idAt(MON, '09:00'), 'Done', local(MON, '12:10'), [NECK.id]);
    expect(ids(corrected.state)).toStrictEqual(['done-1', 'perfect-day']);
  });

  it('ignores dropped Reminders', () => {
    const state = inMadrid(
      [
        reminder(MON, '09:00', 'dropped', { droppedBy: 'pause' }),
        ...doneOn(MON, 3),
        reminder(MON, '12:00', 'scheduled'),
      ],
      { badges: HELD },
    );

    const result = doneResponse(state, idAt(MON, '12:00'), [NECK.id], local(MON, '12:05'));

    expect(result.state.badges).toStrictEqual([...HELD, { id: 'perfect-day', unlockedAt: local(MON, '12:05') }]);
  });

  it('is judged against the goal the day started with: a goal set today applies from tomorrow', () => {
    const monday = inMadrid([reminder(MON, '09:45', 'done'), reminder(MON, '10:30', 'scheduled')], { badges: HELD });
    // Goal 2 from Tuesday: Monday's goal stays 4.
    const lowered = send(monday, { type: 'SetDailyGoal', goal: 2 }, local(MON, '10:00')).state;

    const result = doneResponse(lowered, idAt(MON, '10:30'), [NECK.id], local(MON, '10:35'));

    expect(result.state.badges).toStrictEqual(HELD);

    // The control: with goal 2 already on Monday, the same 2nd Done is a Perfect day.
    const twoFromMonday = { ...monday, goalChanges: [{ from: date(MON), goal: 2 }] };
    const reached = doneResponse(twoFromMonday, idAt(MON, '10:30'), [NECK.id], local(MON, '10:35'));
    expect(reached.state.badges).toStrictEqual([...HELD, { id: 'perfect-day', unlockedAt: local(MON, '10:35') }]);
  });

  it('unlocks for an earlier day too (today so far included): any day that reached its goal cleanly', () => {
    // From before Badges existed: last Friday 4 Done, clean. A Skip today evaluates.
    const state = inMadrid([...doneOn(FRI_BEFORE, 4), reminder(MON, '09:45', 'scheduled')]);

    const result = skipResponse(state, idAt(MON, '09:45'), local(MON, '09:50'));

    expect(ids(result.state)).toStrictEqual(['done-1', 'perfect-day']);
  });
});

describe('Badges: never revoked', () => {
  /** Monday: Perfect day unlocked on the 4th Done at 12:05. */
  const perfectMonday = (): CoreState => {
    const state = inMadrid([...doneOn(MON, 3), reminder(MON, '12:00', 'scheduled')], { badges: holding('done-1') });
    return doneResponse(state, idAt(MON, '12:00'), [NECK.id], local(MON, '12:05')).state;
  };
  const UNLOCKED = [...holding('done-1'), { id: 'perfect-day' as const, unlockedAt: local(MON, '12:05') }];

  it('a same-day correction to Skip or Missed keeps the Badge and its unlockedAt', () => {
    const state = perfectMonday();
    expect(state.badges).toStrictEqual(UNLOCKED);

    const skipped = correct(state, idAt(MON, '09:45'), 'Skip', local(MON, '20:00'));
    expect(skipped.state.badges).toStrictEqual(UNLOCKED);
    expect(unlockedIntents(skipped)).toEqual([]);

    const missed = correct(skipped.state, idAt(MON, '10:30'), 'Missed', local(MON, '20:01'));
    expect(missed.state.badges).toStrictEqual(UNLOCKED);
  });

  it('a later Skip or Missed that day keeps it', () => {
    const state = plus(perfectMonday(), reminder(MON, '12:50', 'scheduled'));

    const skipped = skipResponse(state, idAt(MON, '12:50'), local(MON, '12:55'));
    expect(skipped.state.badges).toStrictEqual(UNLOCKED);

    // 13:40 gets no Response: when 14:25 fires it is Missed, and the Skip on 14:25 evaluates.
    const later = plus(skipped.state, reminder(MON, '13:40', 'scheduled'), reminder(MON, '14:25', 'scheduled'));
    const missed = skipResponse(later, idAt(MON, '14:25'), local(MON, '14:30'));
    expect(missed.state.reminders.find((r) => r.id === idAt(MON, '13:40'))?.status).toBe('missed');
    expect(missed.state.badges).toStrictEqual(UNLOCKED);
  });

  it('never appends a Badge already held: a correction back to Done re-meets Perfect day without a second entry', () => {
    const undone = correct(perfectMonday(), idAt(MON, '09:45'), 'Skip', local(MON, '20:00')).state;

    const redone = correct(undone, idAt(MON, '09:45'), 'Done', local(MON, '20:05'), [NECK.id]);

    expect(redone.state.badges).toStrictEqual(UNLOCKED);
    expect(unlockedIntents(redone)).toEqual([]);
  });

  it('never appends done-1 twice', () => {
    const first = doneResponse(inMadrid([reminder(MON, '09:45', 'scheduled')]), idAt(MON, '09:45'), [NECK.id], local(MON, '09:50'));
    const second = doneResponse(plus(first.state, reminder(MON, '10:35', 'scheduled')), idAt(MON, '10:35'), [NECK.id], local(MON, '10:40'));

    expect(second.state.badges).toStrictEqual([{ id: 'done-1', unlockedAt: local(MON, '09:50') }]);
    expect(unlockedIntents(second)).toEqual([]);
  });
});

describe('Badges: when evaluation runs', () => {
  /**
   * From before Badges existed: last Friday 4 Done (done-1 and Perfect day are
   * met but not held); Monday's 09:45 Reminder outstanding.
   */
  const pending = inMadrid([...doneOn(FRI_BEFORE, 4), reminder(MON, '09:45', 'scheduled')]);
  const NOW = local(MON, '10:00');

  /** After a non-evaluating event: nothing held yet; the next Skip on 09:45 unlocks what was waiting. */
  const expectWaiting = (result: CoreResult) => {
    expect(result.state.badges).toStrictEqual([]);
    expect(unlockedIntents(result)).toEqual([]);
    const skipped = skipResponse(result.state, idAt(MON, '09:45'), local(MON, '10:05'));
    expect(skipped.state.badges).toStrictEqual([
      { id: 'done-1', unlockedAt: local(MON, '10:05') },
      { id: 'perfect-day', unlockedAt: local(MON, '10:05') },
    ]);
  };

  it('on an accepted Skip Response', () => {
    const result = skipResponse(pending, idAt(MON, '09:45'), NOW);
    expect(ids(result.state)).toStrictEqual(['done-1', 'perfect-day']);
  });

  it('on an accepted Done Response with no Did it (recorded as a Skip)', () => {
    const result = doneResponse(pending, idAt(MON, '09:45'), [], NOW);
    expect(ids(result.state)).toStrictEqual(['done-1', 'perfect-day']);
  });

  it('on an accepted Correct of any outcome: a Correct to Done unlocks like a Done', () => {
    const skippedMonday = inMadrid([reminder(MON, '09:45', 'skipped')]);
    const toDone = correct(skippedMonday, idAt(MON, '09:45'), 'Done', local(MON, '20:00'), [NECK.id]);
    expect(toDone.state.badges).toStrictEqual([{ id: 'done-1', unlockedAt: local(MON, '20:00') }]);

    const history = inMadrid([...doneOn(FRI_BEFORE, 4), reminder(MON, '09:45', 'skipped')]);
    const toMissed = correct(history, idAt(MON, '09:45'), 'Missed', local(MON, '20:00'));
    expect(ids(toMissed.state)).toStrictEqual(['done-1', 'perfect-day']);
  });

  it('not on a Snooze', () => {
    expectWaiting(send(pending, { type: 'Response', reminderId: idAt(MON, '09:45'), kind: 'Snooze' }, NOW));
  });

  it('not on a Swap', () => {
    const exercise = (id: string): Exercise => ({
      ...suggested(id),
      source: 'free-exercise-db',
      targetMuscles: ['neck'],
      exerciseType: 'Stretch',
      difficulty: 'Beginner',
      position: 'Either',
      equipment: null,
      energetic: false,
      steps: ['Do it.'],
      photos: null,
    });
    const library = [exercise(NECK.id), exercise('Neck_Turns'), exercise('Chin_Tucks')];

    const result = send(pending, { type: 'Swap', reminderId: idAt(MON, '09:45'), exerciseId: NECK.id }, NOW, library);

    // The Swap was accepted.
    expect(result.state.reminders.find((r) => r.id === idAt(MON, '09:45'))?.swappedOut).toEqual([NECK.id]);
    expectWaiting(result);
  });

  it('not on ChangeSettings, Rearm, AppOpened or SetDailyGoal', () => {
    expectWaiting(send(pending, { type: 'ChangeSettings', change: { intervalMinutes: 60 } }, NOW));
    expectWaiting(send(pending, { type: 'Rearm' }, NOW));
    expectWaiting(send(pending, { type: 'AppOpened' }, NOW));
    expectWaiting(send(pending, { type: 'SetDailyGoal', goal: 3 }, NOW));
  });

  it('not on AchievementsOpened', () => {
    expectWaiting(send(pending, { type: 'AchievementsOpened' }, NOW));
  });

  it('not on a rejected Response or Correct, which return the input state', () => {
    const rejectedDone = doneResponse(pending, 'reminder-0', [NECK.id], NOW);
    expect(rejectedDone.state).toBe(pending);
    expect(rejectedDone.intents).toEqual([{ type: 'DismissNotification', reminderId: 'reminder-0' }]);

    // A past day's Reminder can't be corrected.
    const rejectedCorrect = correct(pending, idAt(FRI_BEFORE, '09:45'), 'Skip', NOW);
    expect(rejectedCorrect).toStrictEqual({ state: pending, intents: [] });
    expect(rejectedCorrect.state).toBe(pending);

    expectWaiting(rejectedCorrect);
  });
});
