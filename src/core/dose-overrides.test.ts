import { describe, expect, it } from 'vitest';
import {
  defaultSettings,
  initialState,
  reduce,
  seededRandom,
  type BodyArea,
  type CoreDeps,
  type CoreEvent,
  type CoreResult,
  type CoreState,
  type Dose,
  type Exercise,
  type Intent,
  type Reminder,
  type ScheduledNotification,
  type Settings,
  type SuggestedExercise,
} from './index';

// All local times below are Europe/Madrid in November 2026: CET, UTC+1, no DST change.
// Default Settings: Mon-Fri 09:00-18:00, 45-minute Interval. A Monday 08:00 Rearm gives
// the chain 09:45, 10:30, ...; at 10:00 the 09:45 Reminder is the outstanding (fired) one
// and every Reminder after 10:00 is the chain ahead.
const ZONE = 'Europe/Madrid';
const local = (date: string, time: string): number => Date.parse(`${date}T${time}:00+01:00`);
const MON = '2026-11-02';
const at = (time: string) => local(MON, time);
const FIRST = `reminder-${at('09:45')}`;

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
const snapshot = ({ id, name, dose, cue, bodyArea }: Exercise): SuggestedExercise => ({ id, name, dose, cue, bodyArea });

/** Library Dose "10 reps"; the override below makes it "25 s each side". */
const NECK_TURN = exercise('Neck_Turn', 'Neck');
/** Library Dose "20 s each side". */
const SHOULDER_ROLL = exercise('Shoulder_Roll', 'Shoulders & Upper Back', {
  dose: { kind: 'seconds', amount: 20, eachSide: true },
});
const TWENTY_FIVE_EACH_SIDE: Dose = { kind: 'seconds', amount: 25, eachSide: true };
const TWELVE_REPS: Dose = { kind: 'reps', amount: 12, eachSide: false };

const cfg = (settings: Partial<Settings> = {}): CoreState => ({
  ...initialState,
  settings: { ...initialState.settings, timeZone: ZONE, ...settings },
});

const depsAt = (when: number, library: readonly Exercise[], seed = 7): CoreDeps => ({
  clock: { now: () => when },
  random: seededRandom(seed),
  library,
});
type Change = Extract<CoreEvent, { type: 'ChangeSettings' }>['change'];
const rearm = (state: CoreState, when: number, library: readonly Exercise[]) =>
  reduce(state, { type: 'Rearm' }, depsAt(when, library));
const change = (state: CoreState, c: Change, when: number, library: readonly Exercise[]) =>
  reduce(state, { type: 'ChangeSettings', change: c }, depsAt(when, library));
const setOverrides = (state: CoreState, doseOverrides: Record<string, Dose>, when: number, library: readonly Exercise[]) =>
  change(state, { doseOverrides }, when, library);
const swap = (state: CoreState, reminderId: string, exerciseId: string, when: number, library: readonly Exercise[]) =>
  reduce(state, { type: 'Swap', reminderId, exerciseId }, depsAt(when, library));
const resetSettings = (state: CoreState, when: number, library: readonly Exercise[]) =>
  reduce(state, { type: 'ResetSettings' }, depsAt(when, library));

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
/** The chain ahead of `when`, non-empty. */
const aheadOf = (state: CoreState, when: number): Reminder[] => {
  const ahead = state.reminders.filter((r) => r.firesAt > when);
  expect(ahead.length).toBeGreaterThan(10);
  return ahead;
};
/** The Suggestion entry for `id` in `r`; fails if `id` is not suggested. */
const entry = (r: Reminder, id: string): SuggestedExercise => {
  const found = r.suggestion.find((e) => e.id === id);
  if (!found) throw new Error(`${id} is not in the Suggestion of ${r.id}: ${r.suggestion.map((e) => e.id).join(', ')}`);
  return found;
};

// Two Exercises, two per Suggestion: every Suggestion is exactly Neck_Turn and Shoulder_Roll.
const PAIR = [NECK_TURN, SHOULDER_ROLL];
const pairState = () => rearm(cfg({ exercisesPerSuggestion: 2 }), at('08:00'), PAIR).state;

describe('Dose overrides: the chain ahead', () => {
  it('every Suggestion ahead carries the overridden Dose for that Exercise; the others keep their library Dose', () => {
    const result = setOverrides(pairState(), { Neck_Turn: TWENTY_FIVE_EACH_SIDE }, at('10:00'), PAIR);

    for (const r of aheadOf(result.state, at('10:00'))) {
      expect(entry(r, 'Neck_Turn')).toStrictEqual({ ...snapshot(NECK_TURN), dose: TWENTY_FIVE_EACH_SIDE });
      expect(entry(r, 'Shoulder_Roll')).toStrictEqual(snapshot(SHOULDER_ROLL));
    }
  });

  it("each notification ahead shows the overridden Dose in the Exercise's line, not the library Dose", () => {
    const result = setOverrides(pairState(), { Neck_Turn: TWENTY_FIVE_EACH_SIDE }, at('10:00'), PAIR);

    const ahead = chainOf(result).filter((n) => n.at > at('10:00'));
    expect(ahead.length).toBeGreaterThan(10);
    for (const n of ahead) {
      const lines = n.body.split('\n');
      expect(lines).toContain('Neck Turn · 25 s each side · Cue for Neck_Turn');
      expect(lines).not.toContain('Neck Turn · 10 reps · Cue for Neck_Turn');
      expect(lines).toContain('Shoulder Roll · 20 s each side · Cue for Shoulder_Roll');
    }
  });

  it('a later Rearm keeps applying the override', () => {
    const changed = setOverrides(pairState(), { Neck_Turn: TWENTY_FIVE_EACH_SIDE }, at('10:00'), PAIR).state;

    const later = rearm(changed, at('11:00'), PAIR).state;

    for (const r of aheadOf(later, at('11:00'))) expect(entry(r, 'Neck_Turn').dose).toStrictEqual(TWENTY_FIVE_EACH_SIDE);
  });

  it('reset to default (the Id removed from the record) brings back the library Dose; other overrides stay', () => {
    const both = setOverrides(
      pairState(),
      { Neck_Turn: TWENTY_FIVE_EACH_SIDE, Shoulder_Roll: TWELVE_REPS },
      at('10:00'),
      PAIR,
    ).state;
    for (const r of aheadOf(both, at('10:00'))) {
      expect(entry(r, 'Neck_Turn').dose).toStrictEqual(TWENTY_FIVE_EACH_SIDE);
      expect(entry(r, 'Shoulder_Roll').dose).toStrictEqual(TWELVE_REPS);
    }

    const result = setOverrides(both, { Shoulder_Roll: TWELVE_REPS }, at('10:05'), PAIR);

    expect(result.state.settings.doseOverrides).toEqual({ Shoulder_Roll: TWELVE_REPS });
    for (const r of aheadOf(result.state, at('10:05'))) {
      expect(entry(r, 'Neck_Turn')).toStrictEqual(snapshot(NECK_TURN));
      expect(entry(r, 'Shoulder_Roll').dose).toStrictEqual(TWELVE_REPS);
    }
  });

  it("leaves the outstanding Reminder's Suggestion as it was: a fired Reminder keeps its snapshot", () => {
    const before = pairState();
    const outstanding = reminderAt(before, at('09:45'));

    const result = setOverrides(before, { Neck_Turn: TWENTY_FIVE_EACH_SIDE }, at('10:00'), PAIR);

    // The change was applied (the chain ahead has it), yet the fired Reminder is untouched.
    expect(result.state.settings.doseOverrides).toEqual({ Neck_Turn: TWENTY_FIVE_EACH_SIDE });
    expect(entry(reminderAt(result.state, at('10:30')), 'Neck_Turn').dose).toStrictEqual(TWENTY_FIVE_EACH_SIDE);
    expect(reminderAt(result.state, at('09:45'))).toStrictEqual(outstanding);
    expect(entry(outstanding, 'Neck_Turn').dose).toStrictEqual(NECK_TURN.dose);
  });
});

describe('Dose overrides: Swap', () => {
  it("the swapped-in Exercise carries its overridden Dose", () => {
    const library = [exercise('Neck_Tilt', 'Neck'), NECK_TURN];
    const armed = rearm(cfg(), at('08:00'), library).state;
    // The outstanding 09:45 Reminder suggests Neck_Tilt, so the only replacement is Neck_Turn.
    const fixed = {
      ...armed,
      reminders: armed.reminders.map((r) =>
        r.firesAt === at('09:45') ? { ...r, suggestion: [snapshot(library[0])] } : r,
      ),
    };
    const overridden = setOverrides(fixed, { Neck_Turn: TWENTY_FIVE_EACH_SIDE }, at('10:00'), library).state;

    const result = swap(overridden, FIRST, 'Neck_Tilt', at('10:01'), library);

    expect(reminderAt(result.state, at('09:45')).suggestion).toStrictEqual([
      { ...snapshot(NECK_TURN), dose: TWENTY_FIVE_EACH_SIDE },
    ]);
  });
});

describe('Dose overrides: the fallback', () => {
  it('when nothing is eligible, the fallback Exercise carries its overridden Dose, in state and in the notification', () => {
    // Above the Beginner ceiling: the pool is empty and Neck_Turn is the only fallback candidate.
    const library = [{ ...NECK_TURN, difficulty: 'Expert' as const }];
    const armed = rearm(cfg({ difficulty: 'Beginner' }), at('08:00'), library).state;

    const result = setOverrides(armed, { Neck_Turn: TWENTY_FIVE_EACH_SIDE }, at('10:00'), library);

    for (const r of aheadOf(result.state, at('10:00'))) {
      expect(r.fallback).toBe(true);
      expect(r.suggestion).toStrictEqual([{ ...snapshot(library[0]), dose: TWENTY_FIVE_EACH_SIDE }]);
    }
    for (const n of chainOf(result).filter((x) => x.at > at('10:00'))) {
      expect(n.body.split('\n')[0]).toBe('Neck Turn · 25 s each side · Cue for Neck_Turn');
    }
  });
});

describe('Dose overrides: ChangeSettings validation', () => {
  const NOW = at('10:00');
  // Casts stand for what an untyped caller (a stale store, a bug) could send.
  const loose = (doseOverrides: unknown) => ({ doseOverrides }) as Change;
  const withDose = (dose: unknown) => loose({ Neck_Turn: dose });

  it.each<[string, Change]>([
    ['an array', loose([TWENTY_FIVE_EACH_SIDE])],
    ['a string', loose('Neck_Turn')],
    ['null', loose(null)],
    ['a Dose that is not an object', withDose(25)],
    ['a Dose that is null', withDose(null)],
    ['an unknown kind', withDose({ kind: 'minutes', amount: 2, eachSide: false })],
    ['amount 0', withDose({ kind: 'reps', amount: 0, eachSide: false })],
    ['amount 1000', withDose({ kind: 'reps', amount: 1000, eachSide: false })],
    ['a non-integer amount', withDose({ kind: 'seconds', amount: 12.5, eachSide: false })],
    ['a negative amount', withDose({ kind: 'reps', amount: -5, eachSide: false })],
    ['an amount that is a string', withDose({ kind: 'reps', amount: '10', eachSide: false })],
    ['eachSide not a boolean', withDose({ kind: 'reps', amount: 10, eachSide: 'yes' })],
    ['a missing kind', withDose({ amount: 10, eachSide: false })],
    ['a missing amount', withDose({ kind: 'reps', eachSide: false })],
    ['a missing eachSide', withDose({ kind: 'reps', amount: 10 })],
    ['an extra key on the Dose', withDose({ kind: 'reps', amount: 10, eachSide: false, sets: 3 })],
    ['one bad Dose among good ones', loose({ Shoulder_Roll: TWELVE_REPS, Neck_Turn: { kind: 'reps', amount: 0, eachSide: false } })],
  ])('rejects %s: the same state object, no intents', (_label, invalid) => {
    const before = pairState();

    const result = change(before, invalid, NOW, PAIR);

    expect(result.state).toBe(before);
    expect(result.intents).toEqual([]);
  });

  it.each<[string, Record<string, Dose>]>([
    ['an empty record', {}],
    ['reps, 1', { Neck_Turn: { kind: 'reps', amount: 1, eachSide: false } }],
    ['seconds each side, 999', { Neck_Turn: { kind: 'seconds', amount: 999, eachSide: true } }],
    ['two Exercises', { Neck_Turn: TWENTY_FIVE_EACH_SIDE, Shoulder_Roll: TWELVE_REPS }],
  ])('accepts %s: stored in the settings, the rest kept, and the chain rescheduled', (_label, doseOverrides) => {
    const before = pairState();

    const result = setOverrides(before, doseOverrides, NOW, PAIR);

    expect(result.state.settings).toEqual({ ...before.settings, doseOverrides });
    expect(result.intents.map((i) => i.type)).toEqual(['ScheduleChain']);
  });
});

describe('Dose overrides: ResetSettings', () => {
  it('the default settings have no Dose overrides', () => {
    expect(defaultSettings.doseOverrides).toEqual({});
  });

  it('clears every Dose override and the chain ahead goes back to the library Doses', () => {
    const overridden = setOverrides(
      pairState(),
      { Neck_Turn: TWENTY_FIVE_EACH_SIDE, Shoulder_Roll: TWELVE_REPS },
      at('10:00'),
      PAIR,
    ).state;
    expect(overridden.settings.doseOverrides).toEqual({ Neck_Turn: TWENTY_FIVE_EACH_SIDE, Shoulder_Roll: TWELVE_REPS });

    const result = resetSettings(overridden, at('10:05'), PAIR);

    expect(result.state.settings.doseOverrides).toEqual({});
    // Reset is back to 1 Exercise per Suggestion: each one is one of the pair, with its library Dose.
    for (const r of aheadOf(result.state, at('10:05'))) {
      for (const e of r.suggestion) expect(e).toStrictEqual(snapshot(e.id === 'Neck_Turn' ? NECK_TURN : SHOULDER_ROLL));
    }
  });
});
