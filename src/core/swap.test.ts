import { describe, expect, it } from 'vitest';
import {
  BODY_AREAS,
  initialState,
  reduce,
  seededRandom,
  type BodyArea,
  type CoreDeps,
  type CoreResult,
  type CoreState,
  type Exercise,
  type Intent,
  type Reminder,
  type ScheduledNotification,
  type Settings,
  type SuggestedExercise,
} from './index';

// All local times below are Europe/Madrid in November 2026: CET, UTC+1, no DST change.
// Default Settings: Mon-Fri 09:00-18:00, 45-minute Interval, 10-minute Snooze delay. A
// Monday 08:00 Rearm gives the no-Response chain 09:45, 10:30, ..., 16:30, 17:15.
const ZONE = 'Europe/Madrid';
const local = (date: string, time: string): number => Date.parse(`${date}T${time}:00+01:00`);
const MON = '2026-11-02';
const TUE = '2026-11-03';
const at = (time: string) => local(MON, time);

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const slug = (area: BodyArea) => area.replace(/\W+/g, '_');

const exercise = (id: string, bodyArea: BodyArea, overrides: Partial<Exercise> = {}): Exercise => ({
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
  ...overrides,
});

/** `n` plain Exercises in every Body Area: `Neck_0`, `Neck_1`, ..., `Hips_Legs_0`, ... */
const perArea = (n: number): Exercise[] =>
  BODY_AREAS.flatMap((area) => range(n).map((i) => exercise(`${slug(area)}_${i}`, area)));
const LIBRARY = perArea(4);
const find = (id: string, library: readonly Exercise[] = LIBRARY): Exercise => {
  const found = library.find((e) => e.id === id);
  if (!found) throw new Error(`${id} is not in the library`);
  return found;
};

const snapshot = ({ id, name, dose, cue, bodyArea }: Exercise): SuggestedExercise => ({ id, name, dose, cue, bodyArea });

const cfg = (settings: Partial<Settings> = {}): CoreState => ({
  ...initialState,
  settings: { ...initialState.settings, timeZone: ZONE, exercisesPerSuggestion: 3, ...settings },
});

const depsAt = (when: number, library: readonly Exercise[] = LIBRARY, seed = 7): CoreDeps => ({
  clock: { now: () => when },
  random: seededRandom(seed),
  library,
});
const rearm = (state: CoreState, when: number, library?: readonly Exercise[], seed?: number) =>
  reduce(state, { type: 'Rearm' }, depsAt(when, library, seed));
const swap = (
  state: CoreState,
  reminderId: string,
  exerciseId: string,
  when: number,
  library?: readonly Exercise[],
  seed?: number,
) => reduce(state, { type: 'Swap', reminderId, exerciseId }, depsAt(when, library, seed));
const respond = (state: CoreState, reminderId: string, kind: 'Skip' | 'Snooze', when: number) =>
  reduce(state, { type: 'Response', reminderId, kind }, depsAt(when));
const done = (state: CoreState, reminderId: string, did: string[], when: number) =>
  reduce(state, { type: 'Response', reminderId, kind: 'Done', did }, depsAt(when));

const chainOf = (result: CoreResult): ScheduledNotification[] => {
  const chains = result.intents.filter(
    (i): i is Extract<Intent, { type: 'ScheduleChain' }> => i.type === 'ScheduleChain',
  );
  expect(chains).toHaveLength(1);
  return chains[0].reminders;
};

const reminderAt = (state: CoreState, firesAt: number): Reminder => {
  const found = state.reminders.find((r) => r.firesAt === firesAt);
  if (!found) throw new Error(`no Reminder at ${new Date(firesAt).toISOString()}`);
  return found;
};
const idsOf = (r: Reminder) => r.suggestion.map((e) => e.id);

/** Rearm at Mon 08:00, then give the 09:45 Reminder the Suggestion `ids` (outstanding from 09:45 to 10:30). */
const morning = (ids: string[], library: readonly Exercise[] = LIBRARY, settings: Partial<Settings> = {}) => {
  const state = rearm(cfg(settings), at('08:00'), library).state;
  const suggestion = ids.map((id) => snapshot(find(id, library)));
  return {
    ...state,
    reminders: state.reminders.map((r) => (r.firesAt === at('09:45') ? { ...r, suggestion } : r)),
  };
};
const FIRST = `reminder-${at('09:45')}`;
const SEEDS = range(20).map((i) => i + 1);

describe('Swap: the replacement', () => {
  it('replaces the Exercise in place with one from the same Body Area, and records the swapped-out Id', () => {
    for (const seed of SEEDS) {
      const state = morning(['Neck_0', 'Chest_Arms_0', 'Hips_Legs_0']);
      const before = reminderAt(state, at('09:45'));

      const after = reminderAt(swap(state, FIRST, 'Chest_Arms_0', at('10:00'), LIBRARY, seed).state, at('09:45'));

      expect(after.suggestion).toHaveLength(3);
      expect(after.suggestion[0]).toStrictEqual(before.suggestion[0]);
      expect(after.suggestion[2]).toStrictEqual(before.suggestion[2]);
      const replacement = after.suggestion[1];
      expect(replacement.bodyArea).toBe('Chest & Arms');
      expect(replacement.id).not.toBe('Chest_Arms_0');
      expect(replacement).toStrictEqual(snapshot(find(replacement.id)));
      expect(after.swappedOut).toEqual(['Chest_Arms_0']);
      const { suggestion: _s, swappedOut: _o, ...rest } = after;
      const { suggestion: _bs, ...restBefore } = before;
      expect(rest).toStrictEqual(restBefore);
    }
  });

  it('with nothing else in that Body Area, takes one from an area not elsewhere in the Suggestion', () => {
    const library = [
      exercise('Neck_0', 'Neck'),
      exercise('Shoulders_0', 'Shoulders & Upper Back'),
      exercise('Shoulders_1', 'Shoulders & Upper Back'),
      exercise('Chest_0', 'Chest & Arms'),
      exercise('Chest_1', 'Chest & Arms'),
      exercise('Wrists_0', 'Wrists & Forearms'),
      exercise('Core_0', 'Core & Lower Back'),
      exercise('Hips_0', 'Hips & Legs'),
    ];
    for (const seed of SEEDS) {
      const state = morning(['Neck_0', 'Shoulders_0', 'Chest_0'], library);

      const after = reminderAt(swap(state, FIRST, 'Neck_0', at('10:00'), library, seed).state, at('09:45'));

      expect(['Wrists_0', 'Core_0', 'Hips_0']).toContain(after.suggestion[0].id);
      expect(idsOf(after).slice(1)).toEqual(['Shoulders_0', 'Chest_0']);
    }
  });

  it('then from any area, but never an Exercise already in the Suggestion', () => {
    const library = [
      exercise('Neck_0', 'Neck'),
      exercise('Shoulders_0', 'Shoulders & Upper Back'),
      exercise('Shoulders_1', 'Shoulders & Upper Back'),
      exercise('Chest_0', 'Chest & Arms'),
    ];
    const state = morning(['Neck_0', 'Shoulders_0', 'Chest_0'], library);

    const after = reminderAt(swap(state, FIRST, 'Neck_0', at('10:00'), library).state, at('09:45'));

    expect(idsOf(after)).toEqual(['Shoulders_1', 'Shoulders_0', 'Chest_0']);
  });

  it('is unlimited: Swaps in a row all succeed, cycling back to swapped-out ones only when nothing else is left', () => {
    const library = [
      exercise('Neck_0', 'Neck'),
      exercise('Neck_1', 'Neck'),
      exercise('Neck_2', 'Neck'),
      exercise('Shoulders_0', 'Shoulders & Upper Back'),
      exercise('Chest_0', 'Chest & Arms'),
    ];
    let state = morning(['Neck_0', 'Shoulders_0', 'Chest_0'], library);
    const swapFirst = (when: string) => {
      const current = reminderAt(state, at('09:45')).suggestion[0].id;
      state = swap(state, FIRST, current, at(when), library).state;
      const after = reminderAt(state, at('09:45'));
      expect(after.suggestion[0].id).not.toBe(current);
      expect(idsOf(after).slice(1)).toEqual(['Shoulders_0', 'Chest_0']);
      return after.suggestion[0].id;
    };

    const first = swapFirst('10:00');
    const second = swapFirst('10:01');
    // Nothing new is left: a swapped-out one comes back.
    const third = swapFirst('10:02');
    const fourth = swapFirst('10:03');

    expect(new Set([first, second])).toEqual(new Set(['Neck_1', 'Neck_2']));
    expect(['Neck_0', first]).toContain(third);
    expect(fourth).not.toBe(third);
    expect(reminderAt(state, at('09:45')).swappedOut).toEqual(['Neck_0', first, second, third]);
  });

  it('swaps a fallback Reminder within the fallback set', () => {
    const baseSet = ['Base_0', 'Base_1', 'Base_2'];
    const library = [
      ...baseSet.map((id) => exercise(id, 'Neck', { difficulty: 'Expert' })),
      exercise('Floor_0', 'Neck', { position: 'Floor' }),
      exercise('Band_0', 'Neck', { equipment: 'resistance bands' }),
    ];
    // Every Exercise is above the Beginner ceiling, on the Floor or needs bands: the pool is empty.
    const state = rearm(cfg({ difficulty: 'Beginner', exercisesPerSuggestion: 1 }), at('08:00'), library).state;
    const before = reminderAt(state, at('09:45'));
    expect(before.fallback).toBe(true);
    const [old] = idsOf(before);

    const after = reminderAt(swap(state, FIRST, old, at('10:00'), library).state, at('09:45'));

    expect(after.fallback).toBe(true);
    expect(after.suggestion).toHaveLength(1);
    expect(baseSet.filter((id) => id !== old)).toContain(after.suggestion[0].id);
    expect(after.swappedOut).toEqual([old]);
  });
});

describe('Swap: not a Response', () => {
  it('keeps lastResponseAt, snoozes and refiresAt, rebuilds the chain, and the pending re-fire shows the swapped Suggestion', () => {
    let state = morning(['Neck_0', 'Chest_Arms_0', 'Hips_Legs_0']);
    state = respond(state, FIRST, 'Snooze', at('10:00')).state;
    const snoozed = reminderAt(state, at('09:45'));
    expect(snoozed.refiresAt).toBe(at('10:10'));

    const result = swap(state, FIRST, 'Neck_0', at('10:05'));
    const after = reminderAt(result.state, at('09:45'));

    expect(after.status).toBe('scheduled');
    expect(after.snoozes).toBe(1);
    expect(after.refiresAt).toBe(at('10:10'));
    expect(result.state.lastResponseAt).toBe(state.lastResponseAt);
    expect(result.intents.map((i) => i.type)).toEqual(['ScheduleChain']);
    const refire = chainOf(result).find((n) => n.reminderId === FIRST);
    expect(refire?.at).toBe(at('10:10'));
    expect(refire?.title).toBe('Time to move (snoozed)');
    expect(refire?.body.split('\n')).toEqual(after.suggestion.map((e) => `${e.name} · 10 reps · ${e.cue}`));
    expect(after.suggestion[0].id).not.toBe('Neck_0');
  });

  it('never moves the Strict rotation', () => {
    const settings: Partial<Settings> = { bodyAreaMode: 'Strict', exercisesPerSuggestion: 1 };
    const state = rearm(cfg(settings), at('08:00')).state;
    const before = reminderAt(state, at('09:45'));
    expect(before.suggestion[0].bodyArea).toBe('Neck');

    const after = swap(state, FIRST, before.suggestion[0].id, at('10:00')).state;

    const swapped = reminderAt(after, at('09:45'));
    expect(swapped.suggestion[0].bodyArea).toBe('Neck');
    expect(swapped.rotation).toBe(before.rotation);
    const ahead = after.reminders.filter((r) => r.firesAt > at('10:00'));
    expect(ahead.map((r) => r.suggestion[0].bodyArea)).toEqual(
      ahead.map((_, i) => BODY_AREAS[(1 + i) % BODY_AREAS.length]),
    );
  });

  it('lets a later Done mark the swapped-in Exercise', () => {
    let state = morning(['Neck_0', 'Chest_Arms_0', 'Hips_Legs_0']);
    state = swap(state, FIRST, 'Neck_0', at('10:00')).state;
    const swappedIn = reminderAt(state, at('09:45')).suggestion[0];

    const after = reminderAt(done(state, FIRST, [swappedIn.id], at('10:05')).state, at('09:45'));

    expect(after.status).toBe('done');
    expect(after.done).toEqual([{ id: swappedIn.id, name: swappedIn.name, bodyArea: 'Neck' }]);
  });
});

describe('Swap and the no-repeat window', () => {
  it('a swapped-out Exercise does not come back in the next 5 Suggestions while the pool allows', () => {
    // 7 Exercises, Suggestions of 1: the window (5 Suggestions plus the swapped-out one) leaves room.
    const library = [...perArea(1), exercise('Neck_extra', 'Neck')];
    for (const seed of SEEDS) {
      let state = rearm(cfg({ exercisesPerSuggestion: 1 }), at('08:00'), library, seed).state;
      const [old] = idsOf(reminderAt(state, at('09:45')));

      state = swap(state, FIRST, old, at('10:00'), library, seed).state;

      const next5 = state.reminders.filter((r) => r.firesAt > at('10:00')).slice(0, 5);
      expect(next5).toHaveLength(5);
      expect(next5.flatMap(idsOf)).not.toContain(old);
    }
  });
});

describe('Swap: which Reminders accept it', () => {
  it('is accepted on one of today’s fired Reminders that settled as Missed', () => {
    const state = morning(['Neck_0', 'Chest_Arms_0', 'Hips_Legs_0']);

    // 10:30 has fired: the 09:45 one is Missed on replacement.
    const after = reminderAt(swap(state, FIRST, 'Neck_0', at('10:35')).state, at('09:45'));

    expect(after.status).toBe('missed');
    expect(after.suggestion[0].id).not.toBe('Neck_0');
    expect(after.swappedOut).toEqual(['Neck_0']);
  });

  it('is accepted on one of today’s fired Reminders that settled as dropped', () => {
    let state = rearm(cfg(), at('08:00')).state;
    const last = reminderAt(state, at('17:15'));
    // Snoozed at 17:55: the re-fire (18:05) lands past the 18:00 window end, so at 18:01 it is dropped.
    state = respond(state, last.id, 'Snooze', at('17:55')).state;
    const [old] = idsOf(last);

    const after = reminderAt(swap(state, last.id, old, at('18:01')).state, at('17:15'));

    expect(after.status).toBe('dropped');
    expect(idsOf(after)).not.toContain(old);
    expect(after.swappedOut).toEqual([old]);
  });

  interface NoOp {
    state: CoreState;
    reminderId: string;
    exerciseId: string;
    when: number;
    library?: Exercise[];
  }
  const cases: { name: string; setup: () => NoOp }[] = [
    {
      name: 'an unknown Reminder',
      setup: () => ({ state: morning(['Neck_0']), reminderId: 'reminder-0', exerciseId: 'Neck_0', when: at('10:00') }),
    },
    {
      name: 'a Reminder not fired yet',
      setup: () => {
        const state = morning(['Neck_0']);
        const later = reminderAt(state, at('10:30'));
        return { state, reminderId: later.id, exerciseId: later.suggestion[0].id, when: at('10:00') };
      },
    },
    {
      name: 'a done Reminder',
      setup: () => ({
        state: done(morning(['Neck_0']), FIRST, ['Neck_0'], at('10:00')).state,
        reminderId: FIRST,
        exerciseId: 'Neck_0',
        when: at('10:05'),
      }),
    },
    {
      name: 'a skipped Reminder',
      setup: () => ({
        state: respond(morning(['Neck_0']), FIRST, 'Skip', at('10:00')).state,
        reminderId: FIRST,
        exerciseId: 'Neck_0',
        when: at('10:05'),
      }),
    },
    {
      name: 'a Reminder from another day',
      setup: () => {
        const state = morning(['Neck_0']);
        const monday = reminderAt(state, at('17:15'));
        return { state, reminderId: monday.id, exerciseId: monday.suggestion[0].id, when: local(TUE, '09:00') };
      },
    },
    {
      name: 'an Exercise not in its Suggestion',
      setup: () => ({
        state: morning(['Neck_0', 'Chest_Arms_0', 'Hips_Legs_0']),
        reminderId: FIRST,
        exerciseId: 'Neck_1',
        when: at('10:00'),
      }),
    },
    {
      name: 'no candidate at all',
      setup: () => {
        const library = [
          exercise('Neck_0', 'Neck'),
          exercise('Chest_0', 'Chest & Arms'),
          exercise('Hips_0', 'Hips & Legs'),
        ];
        return {
          state: morning(['Neck_0', 'Chest_0', 'Hips_0'], library),
          reminderId: FIRST,
          exerciseId: 'Neck_0',
          when: at('10:00'),
          library,
        };
      },
    },
  ];

  it.each(cases)('is a no-op for $name: the same state, no intents', ({ setup }) => {
    const { state, reminderId, exerciseId, when, library } = setup();

    const result = swap(state, reminderId, exerciseId, when, library);

    expect(result.state).toBe(state);
    expect(result.intents).toEqual([]);
  });
});
