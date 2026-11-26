import { describe, expect, it } from 'vitest';
import {
  BODY_AREAS,
  dailyGoalFor,
  defaultSettings,
  initialState,
  reduce,
  seededRandom,
  type BodyArea,
  type CoreDeps,
  type CoreResult,
  type CoreState,
  type Exercise,
  type GoalChange,
  type Intent,
  type LocalDate,
  type Reminder,
  type ScheduledNotification,
  type Settings,
  type SuggestedExercise,
} from './index';

// All local times below are Europe/Madrid in October/November 2026: CET, UTC+1.
// 2 November 2026 is a Monday. Default Settings: Mon-Fri 09:00-18:00, 45-minute
// Interval, weekends off, 2 Exercises per Suggestion, Weighted.
const ZONE = 'Europe/Madrid';
const local = (date: string, time: string): number => Date.parse(`${date}T${time}:00+01:00`);
const date = (iso: string): LocalDate => {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
};
const dateOf = (instant: number) => new Date(instant + 60 * 60 * 1000).toISOString().slice(0, 10);

const FRI_BEFORE = '2026-10-30';
const MON = '2026-11-02';
const TUE = '2026-11-03';
const WED = '2026-11-04';
const SAT = '2026-11-07';
const SUN = '2026-11-08';
const at = (time: string) => local(MON, time);
const NOW = at('12:10');

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
const snapshot = ({ id, name, dose, cue, bodyArea }: Exercise): SuggestedExercise => ({ id, name, dose, cue, bodyArea });

/**
 * Per Body Area: two plain Exercises, plus one each that only the non-default
 * settings below allow (Expert, Energetic, Floor, dumbbells).
 */
const LIBRARY: Exercise[] = BODY_AREAS.flatMap((area) => [
  exercise(`${slug(area)}_0`, area),
  exercise(`${slug(area)}_1`, area),
  exercise(`${slug(area)}_Expert`, area, { difficulty: 'Expert' }),
  exercise(`${slug(area)}_Energetic`, area, { energetic: true }),
  exercise(`${slug(area)}_Floor`, area, { position: 'Floor' }),
  exercise(`${slug(area)}_Dumbbell`, area, { equipment: 'dumbbells' }),
]);
const byId = (id: string): Exercise => {
  const found = LIBRARY.find((e) => e.id === id);
  if (!found) throw new Error(`${id} is not in the library`);
  return found;
};

const allDay = { start: 8 * 60, end: 20 * 60 };
/** Every setting away from its default. */
const CUSTOM: Settings = {
  activeHours: { mon: allDay, tue: allDay, wed: allDay, thu: allDay, fri: allDay, sat: allDay, sun: allDay },
  intervalMinutes: 30,
  timeZone: ZONE,
  snoozeMinutes: 20,
  exercisesPerSuggestion: 2,
  bodyAreaMode: 'Strict',
  difficulty: 'Expert',
  energetic: true,
  floor: true,
  equipment: ['dumbbells', 'resistance bands'],
  excluded: ['Neck_0', 'Neck_1'],
  doseOverrides: { Hips_Legs_0: { kind: 'seconds', amount: 45, eachSide: true } },
  appearance: 'Dark',
};

const reminder = (day: string, time: string, status: Reminder['status'], ex: Exercise[], extra: Partial<Reminder> = {}) => ({
  id: `reminder-${local(day, time)}`,
  firesAt: local(day, time),
  suggestion: ex.map(snapshot),
  status,
  ...(status === 'done' && { done: ex.map(({ id, name, bodyArea }) => ({ id, name, bodyArea })) }),
  ...extra,
});

/** The Activity Log so far: last Friday and this Monday morning, all fired by 12:10, already settled. */
const LOG: Reminder[] = [
  reminder(FRI_BEFORE, '10:00', 'done', [byId('Neck_Expert'), byId('Hips_Legs_Floor')], { rotation: 2 }),
  reminder(FRI_BEFORE, '10:30', 'missed', [byId('Chest_Arms_Dumbbell')], { rotation: 3 }),
  reminder(MON, '09:30', 'done', [byId('Neck_Energetic')], { swappedOut: ['Neck_0'], rotation: 1 }),
  reminder(MON, '10:00', 'skipped', [byId('Core_Lower_Back_Floor')], { snoozes: 1, refiresAt: at('10:20') }),
  reminder(MON, '11:30', 'missed', [byId('Wrists_Forearms_Dumbbell')], { snoozes: 2, refiresAt: at('11:50') }),
  reminder(MON, '12:00', 'scheduled', [byId('Shoulders_Upper_Back_Expert')]),
];
// Past changes (on or before today) and one dated later than tomorrow.
const PAST_GOALS: GoalChange[] = [
  { from: date('2026-10-01'), goal: 6 },
  { from: date('2026-10-26'), goal: 7 },
];
const FUTURE_GOAL: GoalChange = { from: date(WED), goal: 9 };

const before: CoreState = {
  ...initialState,
  lastAppOpenAt: at('11:00'),
  settings: CUSTOM,
  reminders: LOG,
  lastResponseAt: at('10:25'),
  goalChanges: [...PAST_GOALS, FUTURE_GOAL],
};

const depsAt = (when: number): CoreDeps => ({ clock: { now: () => when }, random: seededRandom(7), library: LIBRARY });
const reset = (state: CoreState) => reduce(state, { type: 'ResetSettings' }, depsAt(NOW));

const chainOf = (result: CoreResult): ScheduledNotification[] => {
  const chains = result.intents.filter(
    (i): i is Extract<Intent, { type: 'ScheduleChain' }> => i.type === 'ScheduleChain',
  );
  expect(chains).toHaveLength(1);
  return chains[0].reminders;
};
const timesOf = (result: CoreResult): number[] => chainOf(result).map((n) => n.at);

describe('ResetSettings: every setting back to its default', () => {
  it('returns every setting to defaultSettings, keeping the time zone', () => {
    const result = reset(before);

    expect(result.state.settings).toEqual({ ...defaultSettings, timeZone: ZONE });
  });

  it('defaults to 2 Exercises per Suggestion', () => {
    expect(defaultSettings.exercisesPerSuggestion).toBe(2);
  });

  it("clears the Exclusions and sets Appearance back to 'System'", () => {
    const result = reset(before);

    expect(result.state.settings.excluded).toEqual([]);
    expect(result.state.settings.appearance).toBe('System');
  });
});

describe('ResetSettings: the Daily Goal from tomorrow', () => {
  it("leaves today's Daily Goal and sets tomorrow's and later back to 4", () => {
    expect(dailyGoalFor(before, date(MON))).toBe(7);
    expect(dailyGoalFor(before, date(WED))).toBe(9);

    const result = reset(before);

    expect(dailyGoalFor(result.state, date(MON))).toBe(7);
    expect(dailyGoalFor(result.state, date(TUE))).toBe(4);
    expect(dailyGoalFor(result.state, date(WED))).toBe(4);
  });

  it('keeps the past Daily Goal changes as they were', () => {
    const result = reset(before);

    const key = ({ year, month, day }: LocalDate) => year * 10000 + month * 100 + day;
    const pastOrToday = result.state.goalChanges.filter((c) => key(c.from) <= key(date(MON)));
    expect(pastOrToday).toEqual(PAST_GOALS);
  });
});

describe('ResetSettings: the Activity Log is untouched', () => {
  it('keeps every fired Reminder deep-equal: outcomes, done lists, Snoozes, Suggestions', () => {
    const result = reset(before);

    expect(result.state.reminders.filter((r) => r.firesAt <= NOW)).toEqual(LOG);
  });

  it('keeps lastResponseAt and lastAppOpenAt', () => {
    const result = reset(before);

    expect(result.state.lastResponseAt).toBe(at('10:25'));
    expect(result.state.lastAppOpenAt).toBe(at('11:00'));
  });
});

describe('ResetSettings: the chain ahead is rebuilt with the defaults', () => {
  it('returns only ScheduleChain', () => {
    const result = reset(before);

    expect(result.intents.map((i) => i.type)).toEqual(['ScheduleChain']);
  });

  it('runs one 45-minute Interval after the anchor (the 12:00 fire), within 09:00-18:00, weekends off', () => {
    const result = reset(before);

    const today = timesOf(result).filter((t) => dateOf(t) === MON);
    expect(today).toEqual(['12:45', '13:30', '14:15', '15:00', '15:45', '16:30', '17:15'].map(at));
    expect(timesOf(result).filter((t) => dateOf(t) === TUE)[0]).toBe(local(TUE, '09:45'));
    expect(timesOf(result).filter((t) => dateOf(t) === SAT || dateOf(t) === SUN)).toEqual([]);
    // The Reminders in state match the scheduled chain one for one.
    expect(result.state.reminders.filter((r) => r.firesAt > NOW).map((r) => r.firesAt)).toEqual(timesOf(result));
  });

  it('builds the Suggestions ahead under the default rules: 2 plain Exercises each, Weighted', () => {
    const result = reset(before);

    const rest = result.state.reminders.filter((r) => r.firesAt > NOW);
    expect(rest.length).toBeGreaterThan(0);
    for (const r of rest) {
      expect(r.suggestion).toHaveLength(2);
      expect(r.rotation).toBeUndefined();
      for (const item of r.suggestion) {
        const ex = byId(item.id);
        expect(ex.difficulty).not.toBe('Expert');
        expect(ex.energetic).toBe(false);
        expect(ex.position).not.toBe('Floor');
        expect(ex.equipment).toBeNull();
      }
    }
  });
});
