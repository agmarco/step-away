import { describe, expect, it } from 'vitest';
import { defaultSettings, initialState, type CoreState, type LocalDate, type Pause, type Reminder } from '../../core';
import { droppedBecause, endsAtMidnight, todayLines } from './pauseDisplay';

const reminder = (id: string, firesAt: number): Reminder => ({ id, firesAt, suggestion: [], status: 'done' });
const MIN = 60_000;

describe("Today's lines", () => {
  it('sorts the Pauses in among the Reminders, newest first, a Pause by its start', () => {
    const r1 = reminder('r1', 10 * MIN);
    const r2 = reminder('r2', 40 * MIN);
    const r3 = reminder('r3', 100 * MIN);
    const p1: Pause = { from: 20 * MIN, until: 30 * MIN };
    const p2: Pause = { from: 50 * MIN, until: 90 * MIN };
    // todaysReminders gives newest first; todaysPauses oldest first.
    expect(todayLines([r3, r2, r1], [p1, p2])).toEqual([
      { kind: 'reminder', reminder: r3 },
      { kind: 'pause', pause: p2 },
      { kind: 'reminder', reminder: r2 },
      { kind: 'pause', pause: p1 },
      { kind: 'reminder', reminder: r1 },
    ]);
  });

  it('puts a Pause above a Reminder fired at the same instant', () => {
    const r = reminder('r', 10 * MIN);
    const p: Pause = { from: 10 * MIN, until: 70 * MIN };
    expect(todayLines([r], [p])).toEqual([
      { kind: 'pause', pause: p },
      { kind: 'reminder', reminder: r },
    ]);
  });

  it('is just the Reminders with no Pause, and just the Pauses with no Reminder', () => {
    const r = reminder('r', 10 * MIN);
    const p: Pause = { from: 20 * MIN, until: 30 * MIN };
    expect(todayLines([r], [])).toEqual([{ kind: 'reminder', reminder: r }]);
    expect(todayLines([], [p])).toEqual([{ kind: 'pause', pause: p }]);
  });
});

describe('a Pause for the rest of today', () => {
  it('ends at local midnight in the Settings time zone', () => {
    // 00:00 on Wednesday 2026-11-11 in Madrid is 23:00 UTC on Tuesday.
    expect(endsAtMidnight(Date.UTC(2026, 10, 10, 23, 0), 'Europe/Madrid')).toBe(true);
  });

  it('does not end at midnight at any other time, UTC midnight included', () => {
    expect(endsAtMidnight(Date.UTC(2026, 10, 11, 0, 0), 'Europe/Madrid')).toBe(false);
    expect(endsAtMidnight(Date.UTC(2026, 10, 10, 23, 1), 'Europe/Madrid')).toBe(false);
  });
});

describe('why a Reminder was dropped', () => {
  const MADRID = { ...defaultSettings, timeZone: 'Europe/Madrid' };
  const stateWith = (pauses: Pause[], daysOff: LocalDate[]): CoreState => ({ ...initialState, settings: MADRID, pauses, daysOff });
  // Tuesday 2026-11-10, 10:00 in Madrid (09:00 UTC).
  const tenAm = Date.UTC(2026, 10, 10, 9, 0);
  const dropped: Reminder = { id: 'r', firesAt: tenAm, suggestion: [], status: 'dropped' };
  const tuesday: LocalDate = { year: 2026, month: 11, day: 10 };

  it('is the Day Off when its day is off', () => {
    expect(droppedBecause(dropped, stateWith([], [tuesday]))).toBe('dayOff');
  });

  it('is a Pause started at or after it fired, on its day', () => {
    expect(droppedBecause(dropped, stateWith([{ from: tenAm + 5 * MIN, until: tenAm + 65 * MIN }], []))).toBe('pause');
  });

  it('is closing with no Day Off and no Pause after it on its day', () => {
    const earlier: Pause = { from: tenAm - 120 * MIN, until: tenAm - 60 * MIN };
    // A Pause the next day doesn't count.
    const nextDay: Pause = { from: tenAm + 24 * 60 * MIN, until: tenAm + 25 * 60 * MIN };
    expect(droppedBecause(dropped, stateWith([earlier, nextDay], [{ year: 2026, month: 11, day: 11 }]))).toBe('closing');
  });

  it('is the Pause for a snoozed Reminder a Pause dropped', () => {
    const snoozed: Reminder = { ...dropped, snoozes: 1 };
    expect(droppedBecause(snoozed, stateWith([{ from: tenAm + 7 * MIN, until: tenAm + 67 * MIN }], []))).toBe('pause');
  });
});
