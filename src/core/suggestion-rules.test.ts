import { describe, expect, it } from 'vitest';
import {
  BODY_AREAS,
  DIFFICULTIES,
  POSITIONS,
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
// Default Settings: Mon-Fri 09:00-18:00, 45-minute Interval. A Monday 08:00 Rearm gives
// Monday's chain 09:45 + k·45 (09:45 ... 17:15, 11 Reminders), then Tuesday to Friday:
// 55 Suggestions in all.
const ZONE = 'Europe/Madrid';
const local = (date: string, time: string): number => Date.parse(`${date}T${time}:00+01:00`);
const MON = '2026-11-02';
const TUE = '2026-11-03';
const WED = '2026-11-04';
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

const snapshot = ({ id, name, dose, cue, bodyArea }: Exercise): SuggestedExercise => ({ id, name, dose, cue, bodyArea });

const cfg = (settings: Partial<Settings> = {}, reminders: Reminder[] = []): CoreState => ({
  ...initialState,
  settings: { ...initialState.settings, timeZone: ZONE, ...settings },
  reminders,
});

const depsAt = (when: number, library: readonly Exercise[], seed = 7): CoreDeps => ({
  clock: { now: () => when },
  random: seededRandom(seed),
  library,
});
const rearm = (state: CoreState, when: number, library: readonly Exercise[], seed = 7) =>
  reduce(state, { type: 'Rearm' }, depsAt(when, library, seed));
const respond = (state: CoreState, reminderId: string, kind: 'Skip' | 'Snooze', when: number, lib: Exercise[]) =>
  reduce(state, { type: 'Response', reminderId, kind }, depsAt(when, lib));
const done = (state: CoreState, reminderId: string, did: string[], when: number, lib: Exercise[]) =>
  reduce(state, { type: 'Response', reminderId, kind: 'Done', did }, depsAt(when, lib));

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
const allIds = (state: CoreState) => state.reminders.flatMap(idsOf);
const lookup = (library: readonly Exercise[]) => {
  const byId = new Map(library.map((e) => [e.id, e]));
  return (id: string): Exercise => {
    const found = byId.get(id);
    if (!found) throw new Error(`${id} is not in the library`);
    return found;
  };
};
/** A Reminder from earlier today (Mon 09:45), built by hand. */
const earlier = (status: Reminder['status'], ex: Exercise, extra: Partial<Reminder> = {}): Reminder => ({
  id: `reminder-${at('09:45')}`,
  firesAt: at('09:45'),
  suggestion: [snapshot(ex)],
  status,
  ...(status === 'done' ? { done: [{ id: ex.id, name: ex.name, bodyArea: ex.bodyArea }] } : {}),
  ...extra,
});

/** Fails unless no Suggestion shares an Exercise (suggested or swapped out) with the `window` Suggestions before it. */
const expectWindow = (reminders: Reminder[], window: number) => {
  reminders.forEach((r, i) => {
    const recent = reminders.slice(Math.max(0, i - window), i).flatMap((p) => [...idsOf(p), ...(p.swappedOut ?? [])]);
    const repeated = idsOf(r).filter((id) => recent.includes(id));
    expect(repeated, `Suggestion ${i} repeats within the last ${window}`).toEqual([]);
  });
};

describe('the eligible pool', () => {
  /** The set of `attr` values over every Exercise of every Suggestion of a Mon 08:00 Rearm chain. */
  const valuesSuggested = <K extends keyof Exercise>(library: Exercise[], settings: Partial<Settings>, attr: K) => {
    const find = lookup(library);
    const state = rearm(cfg(settings), at('08:00'), library).state;
    expect(state.reminders.length).toBeGreaterThan(50);
    return new Set(allIds(state).map((id) => find(id)[attr]));
  };

  it('keeps Exercises at or below the Difficulty ceiling: Beginner < Intermediate < Expert', () => {
    const library = BODY_AREAS.flatMap((area) =>
      DIFFICULTIES.map((difficulty) => exercise(`${slug(area)}_${difficulty}`, area, { difficulty })),
    );

    expect(valuesSuggested(library, { difficulty: 'Beginner' }, 'difficulty')).toEqual(new Set(['Beginner']));
    expect(valuesSuggested(library, { difficulty: 'Intermediate' }, 'difficulty')).toEqual(
      new Set(['Beginner', 'Intermediate']),
    );
    expect(valuesSuggested(library, { difficulty: 'Expert' }, 'difficulty')).toEqual(new Set(DIFFICULTIES));
  });

  it('suggests Energetic Exercises only when Energetic is on', () => {
    const library = BODY_AREAS.flatMap((area) => [
      exercise(`${slug(area)}_calm`, area),
      exercise(`${slug(area)}_energetic`, area, { energetic: true }),
    ]);

    expect(valuesSuggested(library, { energetic: false }, 'energetic')).toEqual(new Set([false]));
    expect(valuesSuggested(library, { energetic: true }, 'energetic')).toEqual(new Set([false, true]));
  });

  it('suggests Floor Exercises only when Floor is on; Either, Seated and Standing are never filtered', () => {
    const library = BODY_AREAS.flatMap((area) =>
      POSITIONS.map((position) => exercise(`${slug(area)}_${position}`, area, { position })),
    );

    expect(valuesSuggested(library, { floor: false }, 'position')).toEqual(new Set(['Seated', 'Standing', 'Either']));
    expect(valuesSuggested(library, { floor: true }, 'position')).toEqual(new Set(POSITIONS));
  });

  it('suggests Exercises with no Equipment always, and with Equipment only when it is owned', () => {
    const library = BODY_AREAS.flatMap((area) => [
      exercise(`${slug(area)}_none`, area),
      exercise(`${slug(area)}_dumbbells`, area, { equipment: 'dumbbells' }),
      exercise(`${slug(area)}_bands`, area, { equipment: 'resistance bands' }),
    ]);

    expect(valuesSuggested(library, { equipment: [] }, 'equipment')).toEqual(new Set([null]));
    expect(valuesSuggested(library, { equipment: ['dumbbells'] }, 'equipment')).toEqual(new Set([null, 'dumbbells']));
    expect(valuesSuggested(library, { equipment: ['dumbbells', 'resistance bands'] }, 'equipment')).toEqual(
      new Set([null, 'dumbbells', 'resistance bands']),
    );
  });

  it('never suggests an Excluded Exercise', () => {
    const library = perArea(2);
    const excluded = BODY_AREAS.map((area) => `${slug(area)}_0`);

    const suggested = valuesSuggested(library, { excluded }, 'id');

    expect(suggested).toEqual(new Set(BODY_AREAS.map((area) => `${slug(area)}_1`)));
  });
});

describe('within a Suggestion', () => {
  it.each([2, 3])('a Suggestion of %i has that many Exercises, each from a different Body Area', (count) => {
    const library = perArea(4);
    const state = rearm(cfg({ exercisesPerSuggestion: count }), at('08:00'), library).state;

    expect(state.reminders.length).toBeGreaterThan(50);
    for (const r of state.reminders) {
      expect(r.suggestion).toHaveLength(count);
      expect(new Set(idsOf(r)).size).toBe(count);
      expect(new Set(r.suggestion.map((e) => e.bodyArea)).size).toBe(count);
    }
  });
});

// Two Body Areas of unequal size: an Exercise-uniform draw would give Hips & Legs 3 of every 4.
// Neither area runs out within the 5-Suggestion window.
const LEGS = range(24).map((i) => exercise(`Hips_Legs_${i}`, 'Hips & Legs'));
const NECK = range(8).map((i) => exercise(`Neck_${i}`, 'Neck'));
const UNEQUAL = [...LEGS, ...NECK];
const SEEDS = range(200).map((i) => i + 1);

/** Neck : Hips & Legs over the Suggestions on [from, to), summed over SEEDS Rearms of `state` at Mon 10:00. */
const neckToLegs = (state: CoreState, from: number, to: number): number => {
  const count = { Neck: 0, legs: 0 };
  for (const seed of SEEDS) {
    for (const r of rearm(state, at('10:00'), UNEQUAL, seed).state.reminders) {
      if (r.firesAt <= at('10:00') || r.firesAt < from || r.firesAt >= to) continue;
      for (const e of r.suggestion) {
        if (e.bodyArea === 'Neck') count.Neck += 1;
        else count.legs += 1;
      }
    }
  }
  expect(count.Neck + count.legs).toBeGreaterThan(1500);
  return count.Neck / count.legs;
};
const MONDAY = [local(MON, '00:00'), local(TUE, '00:00')] as const;
const TUESDAY = [local(TUE, '00:00'), local(WED, '00:00')] as const;

describe('Weighted Body Areas (areas first)', () => {
  // Hips & Legs is covered by a Done earlier today.
  const covered = cfg({}, [earlier('done', LEGS[0])]);
  const withLastResponse = { ...covered, lastResponseAt: at('10:00') };

  it('favours ~3:1 a Body Area with no Done Exercise today over one with', () => {
    const ratio = neckToLegs(withLastResponse, ...MONDAY);

    expect(ratio).toBeGreaterThan(2.4);
    expect(ratio).toBeLessThan(3.6);
  });

  it('counts coverage only on its own day: the next day weighs both areas alike (~1:1)', () => {
    const ratio = neckToLegs(withLastResponse, ...TUESDAY);

    expect(ratio).toBeGreaterThan(0.8);
    expect(ratio).toBeLessThan(1.25);
  });

  it.each([
    { status: 'skipped' as const, lastResponseAt: at('10:00') },
    { status: 'missed' as const, lastResponseAt: null },
  ])('gives no coverage for a $status Reminder: both areas stay at weight 3 (~1:1)', ({ status, lastResponseAt }) => {
    const state = { ...cfg({}, [earlier(status, LEGS[0])]), lastResponseAt };

    const ratio = neckToLegs(state, ...MONDAY);

    expect(ratio).toBeGreaterThan(0.8);
    expect(ratio).toBeLessThan(1.25);
  });
});

describe('Random Body Areas (areas first)', () => {
  it('weighs every Body Area alike (~1:1, not the ~1:3 of the Exercise counts), coverage or not', () => {
    const state = { ...cfg({ bodyAreaMode: 'Random' }, [earlier('done', LEGS[0])]), lastResponseAt: at('10:00') };

    const ratio = neckToLegs(state, ...MONDAY);

    expect(ratio).toBeGreaterThan(0.8);
    expect(ratio).toBeLessThan(1.25);
  });
});

describe('Strict rotation', () => {
  const library = perArea(6);
  const strict = (settings: Partial<Settings> = {}, reminders: Reminder[] = []) =>
    cfg({ bodyAreaMode: 'Strict', ...settings }, reminders);
  /** The Body Areas `n` Suggestions walk from BODY_AREAS index `from`, one each. */
  const cycle = (from: number, n: number, areas: readonly BodyArea[] = BODY_AREAS) =>
    range(n).map((i) => areas[(from + i) % areas.length]);
  const areasOf = (reminders: Reminder[]) => reminders.map((r) => r.suggestion.map((e) => e.bodyArea));
  const inOrder = (areas: BodyArea[]) => [...areas].sort((a, b) => BODY_AREAS.indexOf(a) - BODY_AREAS.indexOf(b));

  it('walks BODY_AREAS in order, one area per Suggestion of 1, from the first area', () => {
    const { reminders } = rearm(strict(), at('08:00'), library).state;

    expect(areasOf(reminders)).toEqual(cycle(0, reminders.length).map((a) => [a]));
  });

  it.each([2, 3])('a Suggestion of %i takes the next that many areas', (count) => {
    const { reminders } = rearm(strict({ exercisesPerSuggestion: count }), at('08:00'), library).state;

    reminders.forEach((r, i) => {
      expect(inOrder(r.suggestion.map((e) => e.bodyArea))).toEqual(inOrder(cycle(i * count, count)));
    });
  });

  it('skips Body Areas with nothing in the pool', () => {
    // No Chest & Arms at all; Wrists & Forearms only above the (default Intermediate) ceiling.
    const sparse = [
      ...library.filter((e) => e.bodyArea !== 'Chest & Arms' && e.bodyArea !== 'Wrists & Forearms'),
      exercise('Wrists_Expert', 'Wrists & Forearms', { difficulty: 'Expert' }),
    ];
    const kept: BodyArea[] = ['Neck', 'Shoulders & Upper Back', 'Core & Lower Back', 'Hips & Legs'];

    const { reminders } = rearm(strict(), at('08:00'), sparse).state;

    expect(areasOf(reminders)).toEqual(cycle(0, reminders.length, kept).map((a) => [a]));
  });

  it('advances on every Suggestion, whatever the Response: Done, Skip, Missed', () => {
    let state = rearm(strict(), at('08:00'), library).state;
    const first = reminderAt(state, at('09:45'));
    state = done(state, first.id, idsOf(first), at('10:00'), library).state;
    // The chain counts from the Done: 10:45, 11:30, ...
    state = respond(state, reminderAt(state, at('10:45')).id, 'Skip', at('11:00'), library).state;
    // From the Skip: 11:45, 12:30, 13:15, ... At 12:40 the 11:45 one is Missed (12:30 fired since).
    state = rearm(state, at('12:40'), library).state;

    expect(reminderAt(state, at('09:45')).status).toBe('done');
    expect(reminderAt(state, at('10:45')).status).toBe('skipped');
    expect(reminderAt(state, at('11:45')).status).toBe('missed');
    expect(areasOf(state.reminders)).toEqual(cycle(0, state.reminders.length).map((a) => [a]));
  });

  it('continues across a Rearm from the rotation stored on the fired Reminders', () => {
    // Fired earlier today in Strict mode: the next Strict Suggestion starts from index 4.
    const fired = earlier('done', library[0], { rotation: 4 });
    const state = { ...strict({}, [fired]), lastResponseAt: at('10:00') };

    const ahead = rearm(state, at('10:00'), library).state.reminders.filter((r) => r.firesAt > at('10:00'));

    expect(areasOf(ahead)).toEqual(cycle(4, ahead.length).map((a) => [a]));
    expect(ahead[0].rotation).toBe(5);
    expect(ahead[1].rotation).toBe(0);
  });

  it('continues where it left off after switching to Weighted and back', () => {
    let state = rearm(strict(), at('08:00'), library).state;
    const first = reminderAt(state, at('09:45'));
    expect(first.suggestion.map((e) => e.bodyArea)).toEqual(['Neck']);
    state = done(state, first.id, idsOf(first), at('10:00'), library).state;

    // Weighted from 10:05: the 10:45 Reminder fires as a Weighted one, with no rotation.
    state = rearm({ ...state, settings: { ...state.settings, bodyAreaMode: 'Weighted' } }, at('10:05'), library).state;
    expect(reminderAt(state, at('10:45'))).not.toHaveProperty('rotation');

    // Strict again at 11:00: the next Suggestion (11:30) picks up after Neck.
    state = rearm({ ...state, settings: { ...state.settings, bodyAreaMode: 'Strict' } }, at('11:00'), library).state;
    const ahead = state.reminders.filter((r) => r.firesAt > at('11:00'));
    expect(ahead[0].firesAt).toBe(at('11:30'));
    expect(areasOf(ahead)).toEqual(cycle(1, ahead.length).map((a) => [a]));
  });
});

describe('Strict relaxation when the pinned area is used up', () => {
  it('draws from another area rather than repeat the previous Suggestion, and the rotation advances as before', () => {
    // Neck's only Exercise was in the previous Suggestion (a Weighted one, so no rotation: Strict starts at Neck).
    const neck = exercise('Neck_0', 'Neck');
    const library = [neck, ...perArea(3).filter((e) => e.bodyArea !== 'Neck')];
    const fired = earlier('done', neck);
    const state = { ...cfg({ bodyAreaMode: 'Strict' }, [fired]), lastResponseAt: at('10:00') };

    const ahead = rearm(state, at('10:00'), library).state.reminders.filter((r) => r.firesAt > at('10:00'));

    expect(idsOf(ahead[0])).toHaveLength(1);
    expect(idsOf(ahead[0])).not.toContain('Neck_0');
    expect(ahead[0].rotation).toBe(1);
    expect(ahead[1].suggestion.map((e) => e.bodyArea)).toEqual(['Shoulders & Upper Back']);
  });
});

describe('the no-repeat window', () => {
  it.each([1, 2])(
    'no Exercise reappears within the next 5 Suggestions while the pool allows (Suggestions of %i)',
    (count) => {
      const library = perArea(3);
      let state = rearm(cfg({ exercisesPerSuggestion: count }), at('08:00'), library).state;
      const first = reminderAt(state, at('09:45'));
      state = done(state, first.id, idsOf(first), at('10:00'), library).state;

      expect(state.reminders.length).toBeGreaterThan(50);
      expectWindow(state.reminders, 5);
    },
  );
});

describe('relaxation when the pool is small', () => {
  it('first allows repeated Body Areas (keeping as many distinct as it can), before any window shrink', () => {
    // Two areas with 15 each: 3 Exercises need a repeated area, but the window of 5 never runs dry.
    const library = [
      ...range(15).map((i) => exercise(`Neck_${i}`, 'Neck')),
      ...range(15).map((i) => exercise(`Hips_Legs_${i}`, 'Hips & Legs')),
    ];
    const { reminders } = rearm(cfg({ exercisesPerSuggestion: 3 }), at('08:00'), library).state;

    for (const r of reminders) {
      expect(r.suggestion).toHaveLength(3);
      expect(new Set(r.suggestion.map((e) => e.bodyArea))).toEqual(new Set(['Neck', 'Hips & Legs']));
    }
    expectWindow(reminders, 5);
  });

  it('then shrinks the window: a pool of 2 alternates, repeating 2 Suggestions later, never back to back', () => {
    const library = [exercise('Neck_0', 'Neck'), exercise('Hips_Legs_0', 'Hips & Legs')];
    const sequence = rearm(cfg(), at('08:00'), library).state.reminders.map((r) => idsOf(r).join());

    expect(sequence.length).toBeGreaterThan(50);
    sequence.slice(1).forEach((id, i) => expect(id).not.toBe(sequence[i]));
    expect(sequence.slice(2)).toEqual(sequence.slice(0, -2));
  });

  it('shrinks the window only as far as the pool needs: a pool of 4 keeps a window of 3', () => {
    const library = perArea(1).slice(0, 4);
    const { reminders } = rearm(cfg(), at('08:00'), library).state;

    expect(reminders.length).toBeGreaterThan(50);
    expectWindow(reminders, 3);
  });

  it('then offers fewer Exercises than the setting, rather than repeat the previous Suggestion', () => {
    const library = perArea(1).slice(0, 4);
    const { reminders } = rearm(cfg({ exercisesPerSuggestion: 3 }), at('08:00'), library).state;

    for (const r of reminders) expect(r.suggestion.length).toBeGreaterThan(0);
    expect(reminders.some((r) => r.suggestion.length < 3)).toBe(true);
    expectWindow(reminders, 1);
  });

  it('repeats a Suggestion when the whole (non-empty) pool was in the previous one: not the fallback', () => {
    // The pool is just the dumbbell row; the base-set Exercise is Excluded, so the fallback would pick it.
    const row = exercise('Dumbbell_Row', 'Shoulders & Upper Back', { equipment: 'dumbbells' });
    const library = [row, exercise('Neck_0', 'Neck')];
    const state = cfg({ equipment: ['dumbbells'], excluded: ['Neck_0'] });

    const { reminders } = rearm(state, at('08:00'), library).state;

    expect(reminders.length).toBeGreaterThan(50);
    for (const r of reminders) {
      expect(r.suggestion).toEqual([snapshot(row)]);
      expect(r).not.toHaveProperty('fallback');
    }
  });
});

describe('the fallback (empty pool)', () => {
  // The base set (no Equipment, Position not Floor), each out of the pool for a different reason:
  const baseSet = [
    exercise('Base_Expert_Energetic', 'Neck', { difficulty: 'Expert', energetic: true }),
    exercise('Base_Excluded', 'Hips & Legs', { position: 'Seated' }),
    exercise('Base_Intermediate', 'Chest & Arms', { position: 'Standing', difficulty: 'Intermediate' }),
  ];
  // Out of the pool and out of the base set:
  const notBase = [
    exercise('Floor_Only', 'Core & Lower Back', { position: 'Floor' }),
    exercise('Band_Only', 'Shoulders & Upper Back', { equipment: 'resistance bands' }),
  ];
  const library = [...baseSet, ...notBase];
  const empty = cfg({ difficulty: 'Beginner', excluded: ['Base_Excluded'], exercisesPerSuggestion: 3 });

  it('gives every Reminder exactly 1 gentle base-set Exercise (Beginner, not Energetic), ignoring Exclusions, flagged as fallback', () => {
    const { reminders } = rearm(empty, at('08:00'), library).state;

    expect(reminders.length).toBeGreaterThan(50);
    for (const r of reminders) {
      expect(r.suggestion).toHaveLength(1);
      expect(r.fallback).toBe(true);
    }
    expect(new Set(reminders.flatMap(idsOf))).toEqual(new Set(['Base_Excluded']));
  });

  it('ends a fallback notification with the line "No Exercises match your settings"', () => {
    const find = lookup(library);
    const chain = chainOf(rearm(empty, at('08:00'), library));

    expect(chain.length).toBeGreaterThan(50);
    for (const n of chain) {
      const lines = n.body.split('\n');
      expect(lines).toHaveLength(2);
      const ex = find(lines[0].split(' · ')[0].replace(/ /g, '_'));
      expect(lines[0]).toBe(`${ex.name} · 10 reps · ${ex.cue}`);
      expect(lines[1]).toBe('No Exercises match your settings');
    }
  });

  it('a Reminder built from the pool has no fallback key and no extra line; a fired fallback keeps its flag', () => {
    let state = rearm(empty, at('08:00'), library).state;
    const fired = reminderAt(state, at('09:45'));
    expect(fired.fallback).toBe(true);

    // At 10:00 the ceiling goes up: the pool is no longer empty.
    const result = rearm({ ...state, settings: { ...state.settings, difficulty: 'Expert' } }, at('10:00'), library);
    state = result.state;

    expect(reminderAt(state, at('09:45'))).toStrictEqual(fired);
    const ahead = state.reminders.filter((r) => r.firesAt > at('10:00'));
    expect(ahead.length).toBeGreaterThan(40);
    for (const r of ahead) expect(r).not.toHaveProperty('fallback');
    for (const n of chainOf(result)) expect(n.body).not.toContain('No Exercises match your settings');
  });

  it('never falls back to an Intermediate, Expert or Energetic base Exercise while a Beginner, non-Energetic one exists', () => {
    const gentle = [
      exercise('Gentle_Neck', 'Neck', { position: 'Seated' }),
      exercise('Gentle_Hips', 'Hips & Legs', { position: 'Standing' }),
    ];
    const hard = [
      exercise('Beginner_Energetic', 'Chest & Arms', { energetic: true }),
      exercise('Intermediate_Calm', 'Wrists & Forearms', { difficulty: 'Intermediate' }),
      exercise('Expert_Calm', 'Core & Lower Back', { difficulty: 'Expert' }),
    ];
    const lib = [...hard, ...gentle];
    // The gentle ones are Excluded and the others above the settings: the pool is empty.
    const settings = cfg({ difficulty: 'Beginner', excluded: gentle.map((e) => e.id), exercisesPerSuggestion: 3 });

    const { reminders } = rearm(settings, at('08:00'), lib).state;

    expect(reminders.length).toBeGreaterThan(50);
    for (const r of reminders) expect(r.fallback).toBe(true);
    expect(new Set(reminders.flatMap(idsOf))).toEqual(new Set(['Gentle_Neck', 'Gentle_Hips']));
  });

  it('with only Intermediate, Expert or Energetic base Exercises, still falls back to one of them', () => {
    const hard = [
      exercise('Beginner_Energetic', 'Chest & Arms', { energetic: true }),
      exercise('Intermediate_Calm', 'Wrists & Forearms', { difficulty: 'Intermediate' }),
    ];
    const lib = [...hard, ...notBase];

    const { reminders } = rearm(cfg({ difficulty: 'Beginner' }), at('08:00'), lib).state;

    expect(reminders.length).toBeGreaterThan(50);
    for (const r of reminders) {
      expect(r.suggestion).toHaveLength(1);
      expect(r.fallback).toBe(true);
    }
    expect(new Set(reminders.flatMap(idsOf))).toEqual(new Set(['Beginner_Energetic', 'Intermediate_Calm']));
  });

  it('schedules nothing when there is no fallback candidate either', () => {
    const result = rearm(cfg(), at('08:00'), notBase);

    expect(result.state.reminders).toEqual([]);
    expect(chainOf(result)).toEqual([]);
  });
});

describe('built when it fires', () => {
  const library = perArea(4);

  it('every Rearm rebuilds the not-yet-fired Suggestions under the current settings; fired ones keep theirs', () => {
    const state = rearm(cfg(), at('08:00'), library).state;
    const outstanding = reminderAt(state, at('09:45'));
    // Exclude the whole Body Area of the outstanding Reminder's Exercise.
    const area = outstanding.suggestion[0].bodyArea;
    const excluded = library.filter((e) => e.bodyArea === area).map((e) => e.id);
    expect(state.reminders.filter((r) => r.firesAt > at('10:00')).some((r) => r.suggestion[0].bodyArea === area)).toBe(
      true,
    );

    const after = rearm({ ...state, settings: { ...state.settings, excluded } }, at('10:00'), library).state;

    expect(reminderAt(after, at('09:45'))).toStrictEqual(outstanding);
    const ahead = after.reminders.filter((r) => r.firesAt > at('10:00'));
    expect(ahead.length).toBeGreaterThan(40);
    for (const r of ahead) expect(idsOf(r).filter((id) => excluded.includes(id))).toEqual([]);
  });

  it('a changed Exercises per Suggestion applies to every Reminder not yet fired, not to the outstanding one', () => {
    const state = rearm(cfg(), at('08:00'), library).state;
    const outstanding = reminderAt(state, at('09:45'));

    const after = rearm(
      { ...state, settings: { ...state.settings, exercisesPerSuggestion: 2 } },
      at('10:00'),
      library,
    ).state;

    expect(reminderAt(after, at('09:45'))).toStrictEqual(outstanding);
    const ahead = after.reminders.filter((r) => r.firesAt > at('10:00'));
    expect(ahead.length).toBeGreaterThan(40);
    for (const r of ahead) expect(r.suggestion).toHaveLength(2);
  });
});
