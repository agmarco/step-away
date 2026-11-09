import { describe, expect, it } from 'vitest';
import { BODY_AREAS, initialState, reduce, seededRandom, type Exercise, type Reminder } from './index';

// A guard against a quadratic chain rebuild (each chain Reminder rescanning the whole history).
// The bound is far above the linear time (tens of ms) and far below the quadratic one (many seconds).
const MINUTE = 60_000;
const allDay = { start: 0, end: 24 * 60 };
const now = Date.parse('2026-11-02T08:00:00+01:00');

const library: Exercise[] = BODY_AREAS.flatMap((bodyArea, a) =>
  Array.from({ length: 6 }, (_, i) => ({
    id: `e${a}_${i}`,
    source: 'free-exercise-db' as const,
    name: `e${a} ${i}`,
    targetMuscles: ['neck'],
    bodyArea,
    exerciseType: 'Stretch' as const,
    difficulty: 'Beginner' as const,
    position: 'Either' as const,
    equipment: null,
    energetic: false,
    dose: { kind: 'reps' as const, amount: 10, eachSide: false },
    cue: 'Cue',
    steps: ['Do it.'],
    photos: null,
  })),
);

/** 20,000 Done Reminders, one every 2 minutes up to `now`, oldest first. */
const fired: Reminder[] = Array.from({ length: 20_000 }, (_, i) => {
  const firesAt = now - (20_000 - i) * 2 * MINUTE;
  const { id, name, dose, cue, bodyArea } = library[i % library.length];
  return {
    id: `r${firesAt}`,
    firesAt,
    status: 'done',
    suggestion: [{ id, name, dose, cue, bodyArea }],
    done: [{ id, name, bodyArea }],
  };
});

describe('the chain rebuild', () => {
  it('is linear: a Rearm over 20,000 fired Reminders and a 7-day, 2-minute chain takes well under 1 s', () => {
    const state = {
      ...initialState,
      settings: {
        ...initialState.settings,
        timeZone: 'Europe/Madrid',
        intervalMinutes: 2,
        exercisesPerSuggestion: 3,
        activeHours: { mon: allDay, tue: allDay, wed: allDay, thu: allDay, fri: allDay, sat: allDay, sun: allDay },
      },
      reminders: fired,
    };
    const deps = { clock: { now: () => now }, random: seededRandom(7), library };

    const start = performance.now();
    const { state: rebuilt } = reduce(state, { type: 'Rearm' }, deps);
    const elapsed = performance.now() - start;

    expect(rebuilt.reminders.length - fired.length).toBeGreaterThan(5_000);
    expect(elapsed).toBeLessThan(1_000);
  });
});
